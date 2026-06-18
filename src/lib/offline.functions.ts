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

// ============== IMPORTAR RESPOSTAS (offline) ==============

const importSchema = z.object({
  simuladoId: z.string().uuid(),
  schoolId: z.string().uuid(),
  turmaId: z.string().uuid().optional(),
  linhas: z
    .array(
      z.object({
        matricula: z.string().trim().min(1).max(50),
        respostas: z.record(z.string(), z.string()),
      }),
    )
    .min(1)
    .max(2000),
});

export const importarRespostas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => importSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);

    const { data: questoes, error: qErr } = await context.supabase
      .from("questoes")
      .select("id, numero")
      .eq("simulado_id", data.simuladoId);
    if (qErr) throw qErr;
    if (!questoes || questoes.length === 0) {
      throw new Error("Cadastre as questões deste simulado antes de importar respostas.");
    }
    const numToId = new Map<number, string>(questoes.map((q) => [q.numero, q.id]));

    const normalizeIdentificador = (valor: string) => {
      const limpo = String(valor ?? "").trim().replace(/\s+/g, "").replace(/\.0+$/, "");
      return /^\d+$/.test(limpo) ? String(Number(limpo)) : limpo;
    };
    const variantesIdentificador = (valor: string) => {
      const original = String(valor ?? "").trim();
      const normalizado = normalizeIdentificador(original);
      const variantes = new Set([original, normalizado]);
      if (/^\d+$/.test(normalizado)) {
        variantes.add(normalizado.padStart(2, "0"));
        variantes.add(normalizado.padStart(3, "0"));
        variantes.add(normalizado.padStart(4, "0"));
      }
      return Array.from(variantes).filter(Boolean);
    };

    const matriculas = Array.from(new Set(data.linhas.map((l) => l.matricula.trim())));
    const matriculasBusca = Array.from(new Set(matriculas.flatMap(variantesIdentificador)));
    const { data: alunos, error: aErr } = await context.supabase
      .from("alunos")
      .select("id, matricula, turma_id")
      .eq("school_id", data.schoolId)
      .in("matricula", matriculasBusca);
    if (aErr) throw aErr;
    const alunosCandidatos = data.turmaId
      ? (alunos ?? []).filter((a) => a.turma_id === data.turmaId)
      : (alunos ?? []);
    const alunosParaImportar = alunosCandidatos.length > 0 ? alunosCandidatos : (alunos ?? []);
    const matToAlunoId = new Map<string, string>();
    for (const aluno of alunosParaImportar) {
      matToAlunoId.set(aluno.matricula, aluno.id);
      matToAlunoId.set(normalizeIdentificador(aluno.matricula), aluno.id);
    }

    const naoEncontradas: string[] = [];
    const inserir: Array<{
      aluno_id: string;
      simulado_id: string;
      questao_id: string;
      resposta_escolhida: string;
    }> = [];

    for (const linha of data.linhas) {
      const aluno_id = matToAlunoId.get(linha.matricula.trim()) ?? matToAlunoId.get(normalizeIdentificador(linha.matricula));
      if (!aluno_id) {
        naoEncontradas.push(linha.matricula);
        continue;
      }
      for (const [k, v] of Object.entries(linha.respostas)) {
        const numero = Number(String(k).replace(/\D/g, ""));
        const qid = numToId.get(numero);
        if (!qid) continue;
        const alt = String(v ?? "").trim().toUpperCase();
        if (!["A", "B", "C", "D", "E"].includes(alt)) continue;
        inserir.push({
          aluno_id,
          simulado_id: data.simuladoId,
          questao_id: qid,
          resposta_escolhida: alt,
        });
      }
    }

    if (inserir.length === 0) {
      throw new Error(
        "Nenhuma resposta válida encontrada. Verifique matrículas e colunas Q1, Q2…",
      );
    }

    // Upsert por (aluno_id, questao_id) — refaz se já existia
    const { error: upErr } = await context.supabase
      .from("respostas_alunos")
      .upsert(inserir, { onConflict: "aluno_id,questao_id" });
    if (upErr) throw upErr;

    return {
      respostas_importadas: inserir.length,
      alunos_processados: matriculas.length - naoEncontradas.length,
      matriculas_nao_encontradas: naoEncontradas,
      total_questoes: questoes.length,
    };
  });
