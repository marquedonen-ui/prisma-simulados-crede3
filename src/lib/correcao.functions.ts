import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureProfessorOrAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin") && !roles.includes("professor")) {
    throw new Error("Acesso restrito a professores e administradores.");
  }
  return roles;
}

/** Lista simulados (avaliações diagnósticas) com contagem de alunos que responderam. */
export const listSimuladosCorrecao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);

    const { data: simulados, error } = await context.supabase
      .from("diagnostic_assessments")
      .select("id, offer, subject, grade, gabarito_liberado, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const ids = (simulados ?? []).map((s) => s.id);
    if (ids.length === 0) return [];

    const [{ data: respostas }, { data: questoes }, { data: resultados }] = await Promise.all([
      context.supabase
        .from("respostas_alunos")
        .select("simulado_id, usuario_id")
        .in("simulado_id", ids)
        .range(0, 49999),
      context.supabase.from("questoes").select("simulado_id").in("simulado_id", ids),
      context.supabase
        .from("resultados_simulados")
        .select("simulado_id, usuario_id")
        .in("simulado_id", ids),
    ]);

    return (simulados ?? []).map((s) => {
      const alunosResp = new Set(
        (respostas ?? []).filter((r) => r.simulado_id === s.id).map((r) => r.usuario_id),
      );
      const totalQuestoes = (questoes ?? []).filter((q) => q.simulado_id === s.id).length;
      const totalCorrigidos = (resultados ?? []).filter((r) => r.simulado_id === s.id).length;
      return {
        ...s,
        alunos_responderam: alunosResp.size,
        total_questoes: totalQuestoes,
        total_corrigidos: totalCorrigidos,
      };
    });
  });

/** Corrige automaticamente todas as respostas do simulado. */
export const corrigirSimulado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { simuladoId: string }) =>
    z.object({ simuladoId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { simuladoId } = data;

    // resposta_correta is column-locked to service_role; use admin client after role check.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: questoes, error: qErr } = await supabaseAdmin
      .from("questoes")
      .select("id, resposta_correta, pontos")
      .eq("simulado_id", simuladoId);
    if (qErr) throw qErr;

    if (!questoes || questoes.length === 0) {
      throw new Error("Este simulado ainda não tem questões cadastradas.");
    }

    const questaoMap = new Map(
      questoes.map((q) => [q.id, { correta: q.resposta_correta.toUpperCase(), pontos: q.pontos }]),
    );
    const totalQuestoes = questoes.length;

    const { data: respostas, error: rErr } = await context.supabase
      .from("respostas_alunos")
      .select("usuario_id, aluno_id, questao_id, resposta_escolhida")
      .eq("simulado_id", simuladoId)
      .range(0, 49999);
    if (rErr) throw rErr;
    if (!respostas || respostas.length === 0) {
      throw new Error("Nenhum aluno respondeu este simulado ainda.");
    }

    // Key: "u:<uuid>" para online, "a:<uuid>" para offline
    const porAluno = new Map<string, { acertos: number; pontuacao: number }>();
    for (const r of respostas) {
      const q = questaoMap.get(r.questao_id);
      if (!q) continue;
      const key = r.aluno_id ? `a:${r.aluno_id}` : r.usuario_id ? `u:${r.usuario_id}` : null;
      if (!key) continue;
      const acertou = (r.resposta_escolhida ?? "").toUpperCase() === q.correta;
      const cur = porAluno.get(key) ?? { acertos: 0, pontuacao: 0 };
      if (acertou) {
        cur.acertos += 1;
        cur.pontuacao += q.pontos;
      }
      porAluno.set(key, cur);
    }

    const agora = new Date().toISOString();
    const onlineRows: any[] = [];
    const offlineRows: any[] = [];
    for (const [key, v] of porAluno.entries()) {
      const base = {
        simulado_id: simuladoId,
        pontuacao_obtida: v.pontuacao,
        total_questoes: totalQuestoes,
        acertos: v.acertos,
        percentual: totalQuestoes > 0 ? Number(((v.acertos / totalQuestoes) * 100).toFixed(2)) : 0,
        data_finalizacao: agora,
      };
      if (key.startsWith("a:")) offlineRows.push({ ...base, aluno_id: key.slice(2) });
      else onlineRows.push({ ...base, usuario_id: key.slice(2) });
    }

    if (onlineRows.length > 0) {
      const { error } = await context.supabase
        .from("resultados_simulados")
        .upsert(onlineRows, { onConflict: "usuario_id,simulado_id" });
      if (error) throw error;
    }
    if (offlineRows.length > 0) {
      const { error } = await context.supabase
        .from("resultados_simulados")
        .upsert(offlineRows, { onConflict: "aluno_id,simulado_id" });
      if (error) throw error;
    }

    return { corrigidos: onlineRows.length + offlineRows.length, total_questoes: totalQuestoes };
  });

/** Resultados do simulado (ranking) com nome dos alunos. */
export const listResultados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { simuladoId: string }) =>
    z.object({ simuladoId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);

    const { data: resultados, error } = await context.supabase
      .from("resultados_simulados")
      .select(
        "usuario_id, aluno_id, pontuacao_obtida, total_questoes, percentual, acertos, data_finalizacao",
      )
      .eq("simulado_id", data.simuladoId)
      .order("pontuacao_obtida", { ascending: false });
    if (error) throw error;

    const userIds = (resultados ?? [])
      .map((r) => r.usuario_id)
      .filter((v): v is string => !!v);
    const alunoIds = (resultados ?? [])
      .map((r) => r.aluno_id)
      .filter((v): v is string => !!v);

    const [{ data: perfis }, { data: alunos }] = await Promise.all([
      userIds.length > 0
        ? context.supabase.from("profiles").select("id, full_name, email").in("id", userIds)
        : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; email: string }> }),
      alunoIds.length > 0
        ? context.supabase
            .from("alunos")
            .select("id, nome, matricula, turma, school_id, schools(name)")
            .in("id", alunoIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const perfilMap = new Map((perfis ?? []).map((p) => [p.id, p]));
    const alunoMap = new Map((alunos ?? []).map((a: any) => [a.id, a]));

    return (resultados ?? []).map((r) => {
      if (r.aluno_id) {
        const a: any = alunoMap.get(r.aluno_id);
        return {
          ...r,
          nome: a?.nome ?? "—",
          email: a?.matricula ? `Matrícula ${a.matricula}` : "—",
          turma: a?.turma ?? null,
          escola: a?.schools?.name ?? null,
        };
      }
      const p = r.usuario_id ? perfilMap.get(r.usuario_id) : undefined;
      return {
        ...r,
        nome: p?.full_name ?? p?.email ?? "—",
        email: p?.email ?? "—",
        turma: null,
        escola: null,
      };
    });
  });

export const toggleGabaritoLiberado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { simuladoId: string; liberado: boolean }) =>
    z.object({ simuladoId: z.string().uuid(), liberado: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("diagnostic_assessments")
      .update({ gabarito_liberado: data.liberado })
      .eq("id", data.simuladoId);
    if (error) throw error;
    return { ok: true };
  });

export const getGabarito = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { simuladoId: string }) =>
    z.object({ simuladoId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    // resposta_correta is column-locked to service_role; use admin client after role check.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: questoes, error } = await supabaseAdmin
      .from("questoes")
      .select("numero, enunciado, resposta_correta, pontos, ordem")
      .eq("simulado_id", data.simuladoId)
      .order("ordem", { ascending: true });
    if (error) throw error;
    return questoes ?? [];
  });

