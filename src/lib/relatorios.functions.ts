import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureProfessorOrAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  const allowed = ["admin", "professor", "professor_responsavel", "gestor"];
  if (!roles.some((r: string) => allowed.includes(r))) {
    throw new Error("Acesso restrito.");
  }
}

const idInput = (d: { simuladoId: string }) =>
  z.object({ simuladoId: z.string().uuid() }).parse(d);

/** Lista simulados que já têm respostas anônimas importadas. */
export const listSimuladosComRespostas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { data: simulados, error } = await context.supabase
      .from("diagnostic_assessments")
      .select("id, offer, subject, grade, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const ids = (simulados ?? []).map((s: any) => s.id);
    if (ids.length === 0) return [];
    const { data: resp } = await context.supabase
      .from("respostas_alunos")
      .select("simulado_id, turma_id, numero_chamada")
      .in("simulado_id", ids)
      .not("turma_id", "is", null);
    return (simulados ?? []).map((s: any) => {
      const rs = (resp ?? []).filter((r: any) => r.simulado_id === s.id);
      const alunos = new Set(rs.map((r: any) => `${r.turma_id}|${r.numero_chamada}`));
      return { ...s, total_respostas: rs.length, alunos_distintos: alunos.size };
    });
  });

type Faixas = { muito_critico: number; critico: number; intermediario: number; adequado: number };

function faixaDeAcertos(n: number): keyof Faixas {
  if (n <= 11) return "muito_critico";
  if (n <= 22) return "critico";
  if (n <= 34) return "intermediario";
  return "adequado";
}

/**
 * Carrega o dataset agregado: respostas + gabarito + turmas + escolas.
 * Retorna por aluno (turma_id + numero_chamada), com acertos, total_respondidas
 * e metadados (escola, município, matrícula da turma).
 */
async function carregarDataset(supabase: any, simuladoId: string) {
  const { data: questoes, error: qErr } = await supabase
    .from("questoes")
    .select("id, resposta_correta")
    .eq("simulado_id", simuladoId);
  if (qErr) throw qErr;
  const correct = new Map<string, string>(
    (questoes ?? []).map((q: any) => [q.id, q.resposta_correta]),
  );
  const totalQuestoes = (questoes ?? []).length;

  const { data: respostas, error: rErr } = await supabase
    .from("respostas_alunos")
    .select("turma_id, numero_chamada, nome, questao_id, resposta_escolhida")
    .eq("simulado_id", simuladoId)
    .not("turma_id", "is", null)
    .not("numero_chamada", "is", null);
  if (rErr) throw rErr;


  const turmaIds = Array.from(new Set((respostas ?? []).map((r: any) => r.turma_id)));
  const { data: turmas } = turmaIds.length
    ? await supabase
        .from("turmas")
        .select("id, nome, ano, matricula_atual, school_id, schools(id, name, city, inep)")
        .in("id", turmaIds)
    : { data: [] as any[] };
  const turmaById = new Map((turmas ?? []).map((t: any) => [t.id, t]));

  // Por aluno (turma+chamada)
  const alunos = new Map<
    string,
    {
      turma_id: string;
      numero_chamada: number;
      nome: string | null;
      acertos: number;
      respondidas: number;
      escola: any;
      turma: any;
    }
  >();
  for (const r of respostas ?? []) {
    const key = `${r.turma_id}|${r.numero_chamada}`;
    let a = alunos.get(key);
    if (!a) {
      const turma: any = turmaById.get(r.turma_id);
      a = {
        turma_id: r.turma_id,
        numero_chamada: r.numero_chamada,
        nome: r.nome ?? null,
        acertos: 0,
        respondidas: 0,
        escola: turma?.schools ?? null,
        turma,
      };
      alunos.set(key, a);
    }
    if (!a.nome && r.nome) a.nome = r.nome;
    const alt = String(r.resposta_escolhida ?? "").toUpperCase();
    if (["A", "B", "C", "D", "E"].includes(alt)) {
      a.respondidas += 1;
      if (correct.get(r.questao_id) === alt) a.acertos += 1;
    }
  }

  return {
    totalQuestoes,
    alunos: Array.from(alunos.values()),
    turmas: turmas ?? [],
  };
}


const CITY_DESCONHECIDA = "Sem município";

function cidadeDaEscola(escola: any): string {
  return (escola?.city ?? "").trim() || CITY_DESCONHECIDA;
}

/** Padrão de desempenho — agregado por cidade e por escola dentro da cidade. */
export const getPadraoDesempenho = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { alunos } = await carregarDataset(context.supabase, data.simuladoId);

    const porCidade = new Map<
      string,
      {
        city: string;
        faixas: Faixas;
        total: number;
        escolas: Map<string, { school_id: string; name: string; faixas: Faixas; total: number }>;
      }
    >();

    for (const a of alunos) {
      const city = cidadeDaEscola(a.escola);
      let bucket = porCidade.get(city);
      if (!bucket) {
        bucket = {
          city,
          faixas: { muito_critico: 0, critico: 0, intermediario: 0, adequado: 0 },
          total: 0,
          escolas: new Map(),
        };
        porCidade.set(city, bucket);
      }
      const fx = faixaDeAcertos(a.acertos);
      bucket.faixas[fx] += 1;
      bucket.total += 1;

      const schoolId = a.escola?.id ?? "sem-escola";
      let sb = bucket.escolas.get(schoolId);
      if (!sb) {
        sb = {
          school_id: schoolId,
          name: a.escola?.name ?? "Sem escola",
          faixas: { muito_critico: 0, critico: 0, intermediario: 0, adequado: 0 },
          total: 0,
        };
        bucket.escolas.set(schoolId, sb);
      }
      sb.faixas[fx] += 1;
      sb.total += 1;
    }

    return Array.from(porCidade.values())
      .map((c) => ({
        city: c.city,
        total: c.total,
        faixas: c.faixas,
        escolas: Array.from(c.escolas.values()).sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.city.localeCompare(b.city));
  });

/** Conclusão — finalizou (≥1 resposta) vs. matriculados (turma.matricula_atual). */
export const getConclusao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { alunos, turmas } = await carregarDataset(context.supabase, data.simuladoId);

    // Conta finalizados por turma (alunos com >=1 resposta).
    const finPorTurma = new Map<string, number>();
    for (const a of alunos) {
      if (a.respondidas >= 1) {
        finPorTurma.set(a.turma_id, (finPorTurma.get(a.turma_id) ?? 0) + 1);
      }
    }

    // Cada turma contribui com sua matrícula (mesmo sem respostas, conta como 0 finalizados).
    const porCidade = new Map<
      string,
      {
        city: string;
        finalizaram: number;
        matriculados: number;
        escolas: Map<
          string,
          { school_id: string; name: string; finalizaram: number; matriculados: number }
        >;
      }
    >();

    for (const t of turmas as any[]) {
      const city = cidadeDaEscola(t.schools);
      const fin = finPorTurma.get(t.id) ?? 0;
      const mat = Math.max(fin, t.matricula_atual ?? 0);
      let bucket = porCidade.get(city);
      if (!bucket) {
        bucket = { city, finalizaram: 0, matriculados: 0, escolas: new Map() };
        porCidade.set(city, bucket);
      }
      bucket.finalizaram += fin;
      bucket.matriculados += mat;
      const sid = t.schools?.id ?? "sem-escola";
      let sb = bucket.escolas.get(sid);
      if (!sb) {
        sb = {
          school_id: sid,
          name: t.schools?.name ?? "Sem escola",
          finalizaram: 0,
          matriculados: 0,
        };
        bucket.escolas.set(sid, sb);
      }
      sb.finalizaram += fin;
      sb.matriculados += mat;
    }

    return Array.from(porCidade.values())
      .map((c) => ({
        city: c.city,
        finalizaram: c.finalizaram,
        matriculados: c.matriculados,
        nao_finalizaram: Math.max(0, c.matriculados - c.finalizaram),
        escolas: Array.from(c.escolas.values())
          .map((e) => ({
            ...e,
            nao_finalizaram: Math.max(0, e.matriculados - e.finalizaram),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.city.localeCompare(b.city));
  });

/** Acerto Médio — % de acerto vs % de erro (sobre respostas marcadas). */
export const getAcertoMedio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { alunos } = await carregarDataset(context.supabase, data.simuladoId);

    const porCidade = new Map<
      string,
      {
        city: string;
        acertos: number;
        respondidas: number;
        escolas: Map<
          string,
          { school_id: string; name: string; acertos: number; respondidas: number }
        >;
      }
    >();

    for (const a of alunos) {
      const city = cidadeDaEscola(a.escola);
      let bucket = porCidade.get(city);
      if (!bucket) {
        bucket = { city, acertos: 0, respondidas: 0, escolas: new Map() };
        porCidade.set(city, bucket);
      }
      bucket.acertos += a.acertos;
      bucket.respondidas += a.respondidas;
      const sid = a.escola?.id ?? "sem-escola";
      let sb = bucket.escolas.get(sid);
      if (!sb) {
        sb = {
          school_id: sid,
          name: a.escola?.name ?? "Sem escola",
          acertos: 0,
          respondidas: 0,
        };
        bucket.escolas.set(sid, sb);
      }
      sb.acertos += a.acertos;
      sb.respondidas += a.respondidas;
    }

    const pct = (a: number, b: number) => (b > 0 ? Number(((a / b) * 100).toFixed(1)) : 0);

    return Array.from(porCidade.values())
      .map((c) => ({
        city: c.city,
        acertos: c.acertos,
        erros: Math.max(0, c.respondidas - c.acertos),
        pct_acerto: pct(c.acertos, c.respondidas),
        pct_erro: pct(c.respondidas - c.acertos, c.respondidas),
        escolas: Array.from(c.escolas.values())
          .map((e) => ({
            ...e,
            erros: Math.max(0, e.respondidas - e.acertos),
            pct_acerto: pct(e.acertos, e.respondidas),
            pct_erro: pct(e.respondidas - e.acertos, e.respondidas),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.city.localeCompare(b.city));
  });
