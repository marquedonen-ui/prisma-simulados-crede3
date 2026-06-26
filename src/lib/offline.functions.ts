import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureProfessorOrAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  const allowed = ["admin", "professor", "professor_responsavel"];
  if (!roles.some((r: string) => allowed.includes(r))) {
    throw new Error("Acesso restrito a professores e administradores.");
  }
}

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin")) {
    throw new Error("Acesso restrito a administradores.");
  }
}

// ============== QUESTÕES ==============

export const listQuestoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { simuladoId: string }) =>
    z.object({ simuladoId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("questoes")
      .select("*")
      .eq("simulado_id", data.simuladoId)
      .order("numero", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

const questaoSchema = z.object({
  id: z.string().uuid().optional(),
  simulado_id: z.string().uuid(),
  numero: z.number().int().min(1).max(500),
  enunciado: z.string().min(1).max(4000),
  alternativa_a: z.string().min(1).max(1000),
  alternativa_b: z.string().min(1).max(1000),
  alternativa_c: z.string().min(1).max(1000),
  alternativa_d: z.string().min(1).max(1000),
  alternativa_e: z.string().max(1000).nullable().optional(),
  resposta_correta: z.enum(["A", "B", "C", "D", "E"]),
  pontos: z.number().int().min(1).max(100).default(1),
  ordem: z.number().int().min(0).default(0),
});

export const upsertQuestao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => questaoSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const payload = {
      ...data,
      alternativa_e: data.alternativa_e || null,
      ordem: data.ordem || data.numero,
    };
    const { data: row, error } = await context.supabase
      .from("questoes")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteQuestao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("questoes").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const countQuestoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { simuladoId: string }) =>
    z.object({ simuladoId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { count, error } = await context.supabase
      .from("questoes")
      .select("id", { count: "exact", head: true })
      .eq("simulado_id", data.simuladoId);
    if (error) throw error;
    return { total: count ?? 0 };
  });

// Bulk-save gabarito (apenas número + resposta correta) para um simulado.
// Preenche enunciado/alternativas com placeholder "—" para satisfazer NOT NULL.
const gabaritoSchema = z.object({
  simulado_id: z.string().uuid(),
  total: z.number().int().min(1).max(500),
  answers: z
    .array(
      z.object({
        numero: z.number().int().min(1).max(500),
        resposta_correta: z.enum(["A", "B", "C", "D", "E"]),
      }),
    )
    .min(1),
});

export const saveGabarito = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => gabaritoSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);

    // Remove questões com número > total
    await context.supabase
      .from("questoes")
      .delete()
      .eq("simulado_id", data.simulado_id)
      .gt("numero", data.total);

    // Carrega existentes para preservar enunciado/alternativas se houver
    const { data: existing, error: exErr } = await context.supabase
      .from("questoes")
      .select("id, numero, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e, pontos")
      .eq("simulado_id", data.simulado_id);
    if (exErr) throw exErr;
    const byNumero = new Map<number, any>((existing ?? []).map((r: any) => [r.numero, r]));

    const rows = data.answers.map((a) => {
      const prev = byNumero.get(a.numero);
      return {
        id: prev?.id,
        simulado_id: data.simulado_id,
        numero: a.numero,
        ordem: a.numero,
        enunciado: prev?.enunciado || "—",
        alternativa_a: prev?.alternativa_a || "—",
        alternativa_b: prev?.alternativa_b || "—",
        alternativa_c: prev?.alternativa_c || "—",
        alternativa_d: prev?.alternativa_d || "—",
        alternativa_e: prev?.alternativa_e ?? null,
        pontos: prev?.pontos ?? 1,
        resposta_correta: a.resposta_correta,
      };
    });

    const { error } = await context.supabase
      .from("questoes")
      .upsert(rows, { onConflict: "simulado_id,numero" });
    if (error) throw error;
    return { ok: true, total: data.total };
  });

// ============== ALUNOS ==============

export const listAlunos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { schoolId?: string }) =>
    z.object({ schoolId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("alunos")
      .select("id, matricula, nome, turma, ativo, school_id, schools(name, inep)")
      .order("nome", { ascending: true });
    if (data.schoolId) q = q.eq("school_id", data.schoolId);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

const alunoSchema = z.object({
  id: z.string().uuid().optional(),
  school_id: z.string().uuid(),
  matricula: z.string().trim().min(1).max(50),
  nome: z.string().trim().min(2).max(200),
  turma: z.string().trim().max(50).optional().nullable(),
  ativo: z.boolean().default(true),
});

export const upsertAluno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => alunoSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const payload = { ...data, turma: data.turma || null };
    const { data: row, error } = await context.supabase
      .from("alunos")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteAluno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("alunos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============== IMPORTAR RESPOSTAS (offline, anônimas por turma) ==============

const importSchema = z.object({
  simuladoId: z.string().uuid(),
  schoolId: z.string().uuid(),
  turmaId: z.string().uuid(),
  linhas: z
    .array(
      z.object({
        numero_chamada: z.number().int().min(1).max(9999),
        nome: z.string().trim().max(200).optional(),
        respostas: z.record(z.string(), z.string()),
      }),
    )
    .min(1)
    .max(5000),
});

export const importarRespostas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => importSchema.parse(d))
  .handler(async ({ data, context }) => {
    const tag = `[importarRespostas ${new Date().toISOString()}]`;
    console.log(
      `${tag} start user=${context.userId} simulado=${data.simuladoId} school=${data.schoolId} turma=${data.turmaId} linhas=${data.linhas.length}`,
    );
    try {
      await ensureProfessorOrAdmin(context.supabase, context.userId);

      // Use service role to read answer key; role check above already authorized the caller.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: questoes, error: qErr } = await supabaseAdmin
        .from("questoes")
        .select("id, numero, resposta_correta")
        .eq("simulado_id", data.simuladoId);
      if (qErr) {
        console.error(`${tag} erro ao carregar questões`, qErr);
        throw qErr;
      }
      console.log(`${tag} questões cadastradas no simulado: ${questoes?.length ?? 0}`);
      if (!questoes || questoes.length === 0) {
        throw new Error("Cadastre as questões deste simulado antes de importar respostas.");
      }
      const numToId = new Map<number, string>(questoes.map((q: any) => [q.numero, q.id]));
      const correctById = new Map<string, string>(
        questoes.map((q: any) => [q.id, q.resposta_correta]),
      );

      const { error: delErr, count: delCount } = await context.supabase
        .from("respostas_alunos")
        .delete({ count: "exact" })
        .eq("simulado_id", data.simuladoId)
        .eq("turma_id", data.turmaId);
      if (delErr) {
        console.error(`${tag} erro ao limpar respostas anteriores`, delErr);
        throw delErr;
      }
      console.log(`${tag} respostas anteriores removidas: ${delCount ?? 0}`);

      const inserir: Array<{
        simulado_id: string;
        turma_id: string;
        numero_chamada: number;
        nome: string | null;
        questao_id: string;
        resposta_escolhida: string;
      }> = [];

      const statsPorAluno = new Map<
        number,
        { numero_chamada: number; nome?: string; respondidas: number; em_branco: number; acertos: number }
      >();

      let questoesNaoEncontradas = 0;
      for (const linha of data.linhas) {
        let respondidas = 0;
        let emBranco = 0;
        let acertos = 0;
        for (const [k, v] of Object.entries(linha.respostas)) {
          const numero = Number(String(k).replace(/\D/g, ""));
          const qid = numToId.get(numero);
          if (!qid) {
            questoesNaoEncontradas++;
            continue;
          }
          const alt = String(v ?? "").trim().toUpperCase();
          if (!["A", "B", "C", "D", "E"].includes(alt)) {
            emBranco++;
            continue;
          }
          respondidas++;
          if (correctById.get(qid) === alt) acertos++;
          inserir.push({
            simulado_id: data.simuladoId,
            turma_id: data.turmaId,
            numero_chamada: linha.numero_chamada,
            nome: linha.nome ?? null,
            questao_id: qid,
            resposta_escolhida: alt,
          });
        }

        const prev = statsPorAluno.get(linha.numero_chamada);
        if (prev) {
          prev.respondidas += respondidas;
          prev.em_branco += emBranco;
          prev.acertos += acertos;
          if (!prev.nome && linha.nome) prev.nome = linha.nome;
        } else {
          statsPorAluno.set(linha.numero_chamada, {
            numero_chamada: linha.numero_chamada,
            nome: linha.nome,
            respondidas,
            em_branco: emBranco,
            acertos,
          });
        }
      }

      console.log(
        `${tag} parsing: alunos=${statsPorAluno.size} inserir=${inserir.length} questoes_ignoradas=${questoesNaoEncontradas}`,
      );

      if (inserir.length === 0) {
        throw new Error(
          "Nenhuma resposta válida encontrada. Verifique as colunas de alternativas (Q N Options).",
        );
      }

      const { error: upErr } = await context.supabase
        .from("respostas_alunos")
        .insert(inserir);
      if (upErr) {
        console.error(
          `${tag} erro ao inserir respostas (code=${(upErr as any).code} message=${upErr.message} details=${(upErr as any).details} hint=${(upErr as any).hint})`,
        );
        throw upErr;
      }

      console.log(
        `${tag} sucesso: ${inserir.length} respostas inseridas para ${statsPorAluno.size} aluno(s)`,
      );

      const detalhes_alunos = Array.from(statsPorAluno.values())
        .map((s) => ({
          numero_chamada: s.numero_chamada,
          nome: s.nome ?? null,
          respondidas: s.respondidas,
          acertos: s.acertos,
          erros: Math.max(0, s.respondidas - s.acertos),
          em_branco: s.em_branco,
        }))
        .sort((a, b) => b.acertos - a.acertos);

      return {
        respostas_importadas: inserir.length,
        alunos_processados: statsPorAluno.size,
        total_questoes: questoes.length,
        detalhes_alunos,
      };
    } catch (err) {
      console.error(`${tag} FALHOU`, err instanceof Error ? err.message : err);
      throw err;
    }
  });

// ============== GERENCIAR IMPORTAÇÕES ==============

export const listImportacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("respostas_alunos")
      .select("simulado_id, turma_id, numero_chamada, data_resposta")
      .not("turma_id", "is", null)
      .limit(50000);
    if (error) throw error;

    const map = new Map<
      string,
      {
        simulado_id: string;
        turma_id: string;
        _alunos: Set<number>;
        respostas: number;
        ultima: string;
      }
    >();
    for (const r of (data ?? []) as any[]) {
      const key = `${r.simulado_id}::${r.turma_id}`;
      let item = map.get(key);
      if (!item) {
        item = {
          simulado_id: r.simulado_id,
          turma_id: r.turma_id,
          _alunos: new Set<number>(),
          respostas: 0,
          ultima: r.data_resposta,
        };
        map.set(key, item);
      }
      if (r.numero_chamada != null) item._alunos.add(r.numero_chamada);
      item.respostas++;
      if (r.data_resposta > item.ultima) item.ultima = r.data_resposta;
    }

    const simIds = Array.from(new Set(Array.from(map.values()).map((i) => i.simulado_id)));
    const turmaIds = Array.from(new Set(Array.from(map.values()).map((i) => i.turma_id)));

    const [simRes, turmaRes] = await Promise.all([
      simIds.length
        ? context.supabase
            .from("diagnostic_assessments")
            .select("id, offer, subject, grade")
            .in("id", simIds)
        : Promise.resolve({ data: [], error: null } as any),
      turmaIds.length
        ? context.supabase
            .from("turmas")
            .select("id, nome, schools(name, inep)")
            .in("id", turmaIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);
    if (simRes.error) throw simRes.error;
    if (turmaRes.error) throw turmaRes.error;

    const simMap = new Map<string, any>((simRes.data ?? []).map((s: any) => [s.id, s]));
    const turmaMap = new Map<string, any>((turmaRes.data ?? []).map((t: any) => [t.id, t]));

    return Array.from(map.values())
      .map((i) => {
        const s = simMap.get(i.simulado_id);
        const t = turmaMap.get(i.turma_id);
        return {
          simulado_id: i.simulado_id,
          turma_id: i.turma_id,
          simulado: s
            ? `${s.offer ?? ""} · ${s.subject ?? ""} · ${s.grade ?? ""}`
            : "(simulado removido)",
          turma: t?.nome ?? "(turma removida)",
          escola: t?.schools?.name ?? "—",
          inep: t?.schools?.inep ?? "",
          alunos: i._alunos.size,
          respostas: i.respostas,
          ultima: i.ultima,
        };
      })
      .sort((a, b) => (a.ultima < b.ultima ? 1 : -1));
  });


export const listImportacaoAlunos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { simuladoId: string; turmaId: string }) =>
    z.object({ simuladoId: z.string().uuid(), turmaId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("respostas_alunos")
      .select("numero_chamada, nome")
      .eq("simulado_id", data.simuladoId)
      .eq("turma_id", data.turmaId)
      .not("numero_chamada", "is", null);
    if (error) throw error;
    const map = new Map<number, { numero_chamada: number; nome: string | null; respostas: number }>();
    for (const r of (rows ?? []) as any[]) {
      const k = r.numero_chamada as number;
      const cur = map.get(k);
      if (cur) {
        cur.respostas++;
        if (!cur.nome && r.nome) cur.nome = r.nome;
      } else {
        map.set(k, { numero_chamada: k, nome: r.nome ?? null, respostas: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.numero_chamada - b.numero_chamada);
  });

export const deleteImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { simuladoId: string; turmaId: string }) =>
    z.object({ simuladoId: z.string().uuid(), turmaId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { error, count } = await context.supabase
      .from("respostas_alunos")
      .delete({ count: "exact" })
      .eq("simulado_id", data.simuladoId)
      .eq("turma_id", data.turmaId);
    if (error) throw error;
    return { ok: true, removidas: count ?? 0 };
  });

export const deleteTodasImportacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error, count } = await context.supabase
      .from("respostas_alunos")
      .delete({ count: "exact" })
      .not("turma_id", "is", null);
    if (error) throw error;
    return { ok: true, removidas: count ?? 0 };
  });

export const deleteImportacaoAluno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { simuladoId: string; turmaId: string; numeroChamada: number }) =>
    z
      .object({
        simuladoId: z.string().uuid(),
        turmaId: z.string().uuid(),
        numeroChamada: z.number().int().min(1).max(9999),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { error, count } = await context.supabase
      .from("respostas_alunos")
      .delete({ count: "exact" })
      .eq("simulado_id", data.simuladoId)
      .eq("turma_id", data.turmaId)
      .eq("numero_chamada", data.numeroChamada);
    if (error) throw error;
    return { ok: true, removidas: count ?? 0 };
  });

export const updateImportacaoAluno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      simuladoId: string;
      turmaId: string;
      numeroChamada: number;
      novoNumero?: number;
      nome?: string | null;
    }) =>
      z
        .object({
          simuladoId: z.string().uuid(),
          turmaId: z.string().uuid(),
          numeroChamada: z.number().int().min(1).max(9999),
          novoNumero: z.number().int().min(1).max(9999).optional(),
          nome: z.string().trim().max(200).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const patch: { nome?: string | null; numero_chamada?: number } = {};
    if (data.nome !== undefined) patch.nome = data.nome && data.nome.length ? data.nome : null;
    if (data.novoNumero !== undefined && data.novoNumero !== data.numeroChamada) {
      patch.numero_chamada = data.novoNumero;
    }
    if (Object.keys(patch).length === 0) return { ok: true, atualizadas: 0 };
    const { error, count } = await context.supabase
      .from("respostas_alunos")
      .update(patch, { count: "exact" })
      .eq("simulado_id", data.simuladoId)
      .eq("turma_id", data.turmaId)
      .eq("numero_chamada", data.numeroChamada);
    if (error) throw error;
    return { ok: true, atualizadas: count ?? 0 };
  });



