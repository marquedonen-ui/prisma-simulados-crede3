import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureProfessorOrAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  const allowed = ["admin", "professor", "professor_responsavel", "gestor"];
  if (!roles.some((r: string) => allowed.includes(r))) {
    throw new Error("Acesso restrito.");
  }
}

/** Lista simulados que já têm respostas importadas (offline) ou online. */
export const listSimuladosComRespostas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { data: simulados, error } = await context.supabase
      .from("diagnostic_assessments")
      .select("id, offer, subject, grade, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const ids = (simulados ?? []).map((s) => s.id);
    if (ids.length === 0) return [];
    const { data: resp } = await context.supabase
      .from("respostas_alunos")
      .select("simulado_id, aluno_id, usuario_id")
      .in("simulado_id", ids);
    return (simulados ?? []).map((s) => {
      const rs = (resp ?? []).filter((r) => r.simulado_id === s.id);
      const alunos = new Set(rs.map((r) => r.aluno_id ?? r.usuario_id));
      return { ...s, total_respostas: rs.length, alunos_distintos: alunos.size };
    });
  });

/** Relatório completo de um simulado: por aluno + por questão (descritor). */
export const getRelatorioSimulado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { simuladoId: string; turmaId?: string; schoolId?: string }) =>
    z
      .object({
        simuladoId: z.string().uuid(),
        turmaId: z.string().uuid().optional(),
        schoolId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);

    const { data: simulado, error: sErr } = await context.supabase
      .from("diagnostic_assessments")
      .select("id, offer, subject, grade")
      .eq("id", data.simuladoId)
      .maybeSingle();
    if (sErr) throw sErr;

    const { data: questoes, error: qErr } = await context.supabase
      .from("questoes")
      .select("id, numero, enunciado, resposta_correta, pontos")
      .eq("simulado_id", data.simuladoId)
      .order("numero", { ascending: true });
    if (qErr) throw qErr;
    const correctById = new Map((questoes ?? []).map((q) => [q.id, q.resposta_correta]));
    const numeroById = new Map((questoes ?? []).map((q) => [q.id, q.numero]));

    const { data: respostas, error: rErr } = await context.supabase
      .from("respostas_alunos")
      .select("aluno_id, usuario_id, questao_id, resposta_escolhida")
      .eq("simulado_id", data.simuladoId);
    if (rErr) throw rErr;

    const alunoIds = Array.from(
      new Set((respostas ?? []).map((r) => r.aluno_id).filter((v): v is string => !!v)),
    );

    const { data: alunos } = alunoIds.length
      ? await context.supabase
          .from("alunos")
          .select("id, nome, matricula, turma_id, school_id, turmas(nome, ano, turno), schools(name)")
          .in("id", alunoIds)
      : { data: [] as any[] };

    let alunosFiltrados: any[] = alunos ?? [];
    if (data.schoolId) alunosFiltrados = alunosFiltrados.filter((a) => a.school_id === data.schoolId);
    if (data.turmaId) alunosFiltrados = alunosFiltrados.filter((a) => a.turma_id === data.turmaId);
    const alunoMap = new Map(alunosFiltrados.map((a) => [a.id, a]));
    const respostasFiltradas = (respostas ?? []).filter(
      (r) => r.aluno_id && alunoMap.has(r.aluno_id),
    );

    const total_questoes = (questoes ?? []).length;

    // Por aluno
    const porAluno = new Map<
      string,
      { acertos: number; respondidas: number }
    >();
    for (const r of respostasFiltradas) {
      const key = r.aluno_id!;
      const cur = porAluno.get(key) ?? { acertos: 0, respondidas: 0 };
      cur.respondidas += 1;
      if ((r.resposta_escolhida ?? "").toUpperCase() === correctById.get(r.questao_id))
        cur.acertos += 1;
      porAluno.set(key, cur);
    }

    const alunosOut = Array.from(porAluno.entries())
      .map(([id, v]) => {
        const a: any = alunoMap.get(id) ?? {};
        return {
          aluno_id: id,
          nome: a.nome ?? "—",
          matricula: a.matricula ?? "—",
          turma: a.turmas ? `${a.turmas.nome} · ${a.turmas.ano}` : null,
          escola: a.schools?.name ?? null,
          acertos: v.acertos,
          erros: Math.max(0, v.respondidas - v.acertos),
          em_branco: Math.max(0, total_questoes - v.respondidas),
          percentual: total_questoes ? Number(((v.acertos / total_questoes) * 100).toFixed(1)) : 0,
        };
      })
      .sort((a, b) => b.acertos - a.acertos);

    // Por questão
    const porQuestao = new Map<
      string,
      { A: number; B: number; C: number; D: number; E: number; acertos: number; total: number }
    >();
    for (const q of questoes ?? [])
      porQuestao.set(q.id, { A: 0, B: 0, C: 0, D: 0, E: 0, acertos: 0, total: 0 });
    for (const r of respostasFiltradas) {
      const bucket = porQuestao.get(r.questao_id);
      if (!bucket) continue;
      const alt = (r.resposta_escolhida ?? "").toUpperCase() as "A" | "B" | "C" | "D" | "E";
      if (["A", "B", "C", "D", "E"].includes(alt)) bucket[alt] += 1;
      bucket.total += 1;
      if (alt === correctById.get(r.questao_id)) bucket.acertos += 1;
    }

    const questoesOut = (questoes ?? []).map((q) => {
      const b = porQuestao.get(q.id)!;
      return {
        numero: q.numero,
        enunciado: q.enunciado,
        resposta_correta: q.resposta_correta,
        total_respostas: b.total,
        acertos: b.acertos,
        pct_acerto: b.total ? Number(((b.acertos / b.total) * 100).toFixed(1)) : 0,
        distribuicao: { A: b.A, B: b.B, C: b.C, D: b.D, E: b.E },
      };
    });

    // Padrões de desempenho (faixas)
    const faixas = { abaixo: 0, basico: 0, adequado: 0, avancado: 0 };
    for (const a of alunosOut) {
      if (a.percentual < 25) faixas.abaixo++;
      else if (a.percentual < 50) faixas.basico++;
      else if (a.percentual < 75) faixas.adequado++;
      else faixas.avancado++;
    }

    return {
      simulado,
      total_questoes,
      total_alunos: alunosOut.length,
      media_acertos: alunosOut.length
        ? Number(
            (
              alunosOut.reduce((s, a) => s + a.acertos, 0) / alunosOut.length
            ).toFixed(2),
          )
        : 0,
      media_percentual: alunosOut.length
        ? Number(
            (
              alunosOut.reduce((s, a) => s + a.percentual, 0) / alunosOut.length
            ).toFixed(1),
          )
        : 0,
      faixas,
      alunos: alunosOut,
      questoes: questoesOut,
    };
  });
