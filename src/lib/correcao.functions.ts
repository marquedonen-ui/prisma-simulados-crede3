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
        .in("simulado_id", ids),
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

    const { data: questoes, error: qErr } = await context.supabase
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
      .select("usuario_id, questao_id, resposta_escolhida")
      .eq("simulado_id", simuladoId);
    if (rErr) throw rErr;
    if (!respostas || respostas.length === 0) {
      throw new Error("Nenhum aluno respondeu este simulado ainda.");
    }

    const porAluno = new Map<string, { acertos: number; pontuacao: number }>();
    for (const r of respostas) {
      const q = questaoMap.get(r.questao_id);
      if (!q) continue;
      const acertou = (r.resposta_escolhida ?? "").toUpperCase() === q.correta;
      const cur = porAluno.get(r.usuario_id) ?? { acertos: 0, pontuacao: 0 };
      if (acertou) {
        cur.acertos += 1;
        cur.pontuacao += q.pontos;
      }
      porAluno.set(r.usuario_id, cur);
    }

    const agora = new Date().toISOString();
    const rows = Array.from(porAluno.entries()).map(([usuario_id, v]) => ({
      usuario_id,
      simulado_id: simuladoId,
      pontuacao_obtida: v.pontuacao,
      total_questoes: totalQuestoes,
      acertos: v.acertos,
      percentual: totalQuestoes > 0 ? Number(((v.acertos / totalQuestoes) * 100).toFixed(2)) : 0,
      data_finalizacao: agora,
    }));

    const { error: upErr } = await context.supabase
      .from("resultados_simulados")
      .upsert(rows, { onConflict: "usuario_id,simulado_id" });
    if (upErr) throw upErr;

    return { corrigidos: rows.length, total_questoes: totalQuestoes };
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
      .select("usuario_id, pontuacao_obtida, total_questoes, percentual, acertos, data_finalizacao")
      .eq("simulado_id", data.simuladoId)
      .order("pontuacao_obtida", { ascending: false });
    if (error) throw error;

    const ids = (resultados ?? []).map((r) => r.usuario_id);
    let perfis: Array<{ id: string; full_name: string | null; email: string }> = [];
    if (ids.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      perfis = profs ?? [];
    }
    const perfilMap = new Map(perfis.map((p) => [p.id, p]));

    return (resultados ?? []).map((r) => {
      const p = perfilMap.get(r.usuario_id);
      return {
        ...r,
        nome: p?.full_name ?? p?.email ?? "—",
        email: p?.email ?? "—",
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
    const { data: questoes, error } = await context.supabase
      .from("questoes")
      .select("numero, enunciado, resposta_correta, pontos, ordem")
      .eq("simulado_id", data.simuladoId)
      .order("ordem", { ascending: true });
    if (error) throw error;
    return questoes ?? [];
  });
