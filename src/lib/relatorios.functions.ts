import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureProfessorOrAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  const allowed = [
    "admin",
    "professor",
    "professor_responsavel",
    "gestor",
    "superintendente",
    "professor_escola",
  ];
  if (!roles.some((r: string) => allowed.includes(r))) {
    throw new Error("Acesso restrito.");
  }
  return roles as string[];
}

/** Retorna o school_id ao qual o usuário está restrito (null para admin/superintendente). */
async function getScopeSchoolId(supabase: any, userId: string): Promise<string | null> {
  const roles = await ensureProfessorOrAdmin(supabase, userId);
  if (roles.includes("admin") || roles.includes("superintendente")) return null;
  const { data: prof } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", userId)
    .maybeSingle();
  return (prof?.school_id as string | null) ?? null;
}

/** Retorna turmas em que o usuário está lotado (apenas para professor_escola). */
async function getScopeTurmaIds(supabase: any, userId: string): Promise<string[] | null> {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const rs = (roles ?? []).map((r: any) => r.role);
  if (!rs.includes("professor_escola")) return null;
  const { data } = await supabase
    .from("professor_turmas")
    .select("turma_id")
    .eq("user_id", userId);
  return (data ?? []).map((r: any) => r.turma_id as string);
}

export const getMyReportScope = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const schoolId = await getScopeSchoolId(context.supabase, context.userId);
    const turmaIds = await getScopeTurmaIds(context.supabase, context.userId);
    if (!schoolId)
      return {
        scoped: false,
        schoolId: null as string | null,
        schoolName: null as string | null,
        turmaIds: turmaIds ?? null,
      };
    const { data: sch } = await context.supabase
      .from("schools")
      .select("id, name")
      .eq("id", schoolId)
      .maybeSingle();
    return {
      scoped: true,
      schoolId,
      schoolName: (sch?.name as string | null) ?? null,
      turmaIds: turmaIds ?? null,
    };
  });

const idInput = (d: { simuladoId: string }) =>
  z.object({ simuladoId: z.string().uuid() }).parse(d);

const PAGE_SIZE = 1000;

async function fetchAllRows<T>(buildQuery: () => any): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: resumo, error: rErr } = await supabaseAdmin.rpc(
      "rel_simulados_resumo" as any,
      {} as any,
    );
    if (rErr) throw rErr;
    const byId = new Map<string, any>(
      ((resumo ?? []) as any[]).map((r) => [r.simulado_id, r]),
    );
    return (simulados ?? []).map((s: any) => {
      const r = byId.get(s.id);
      return {
        ...s,
        total_respostas: Number(r?.total_respostas ?? 0),
        alunos_distintos: Number(r?.alunos_distintos ?? 0),
      };
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
async function carregarDataset(
  supabase: any,
  simuladoId: string,
  opts?: {
    disciplina?: string | null;
    scopeSchoolId?: string | null;
    scopeTurmaIds?: string[] | null;
  },
) {
  // A função retorna uma linha por aluno. O Data API limita cada resposta a
  // 1.000 linhas, então buscamos todas as páginas antes de aplicar o escopo.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const disciplinaFilter = (opts?.disciplina ?? "").trim();

  const rows = await fetchAllRows<any>(() =>
    supabaseAdmin
      .rpc("rel_alunos_agg" as any, {
        p_simulado: simuladoId,
        p_disciplina: disciplinaFilter ? disciplinaFilter : null,
      } as any)
      .order("turma_id", { ascending: true })
      .order("numero_chamada", { ascending: true }),
  );

  let totalQuestoes = rows.length ? Number(rows[0].total_questoes ?? 0) : 0;
  if (!rows.length) {
    let q = supabaseAdmin
      .from("questoes")
      .select("id", { count: "exact", head: true })
      .eq("simulado_id", simuladoId);
    if (disciplinaFilter) q = q.eq("disciplina", disciplinaFilter);
    const { count } = await q;
    totalQuestoes = count ?? 0;
  }

  const turmaIds = Array.from(new Set(rows.map((r) => r.turma_id).filter(Boolean)));
  const { data: turmasRaw } = turmaIds.length
    ? await supabase
        .from("turmas")
        .select("id, nome, ano, matricula_atual, school_id, schools(id, name, city, inep)")
        .in("id", turmaIds)
    : { data: [] as any[] };
  const scopeSchoolId = opts?.scopeSchoolId ?? null;
  const scopeTurmaSet =
    opts?.scopeTurmaIds && opts.scopeTurmaIds.length >= 0
      ? new Set(opts.scopeTurmaIds)
      : null;
  let turmas = scopeSchoolId
    ? (turmasRaw ?? []).filter((t: any) => t.school_id === scopeSchoolId)
    : (turmasRaw ?? []);
  if (scopeTurmaSet) {
    turmas = turmas.filter((t: any) => scopeTurmaSet.has(t.id));
  }
  const turmaById = new Map((turmas ?? []).map((t: any) => [t.id, t]));

  const alunos = rows
    .filter((r) => (scopeSchoolId || scopeTurmaSet ? turmaById.has(r.turma_id) : true))
    .map((r) => {
      const turma: any = turmaById.get(r.turma_id);
      return {
        turma_id: r.turma_id as string,
        numero_chamada: Number(r.numero_chamada),
        nome: (r.nome as string | null) ?? null,
        acertos: Number(r.acertos ?? 0),
        respondidas: Number(r.respondidas ?? 0),
        escola: turma?.schools ?? null,
        turma,
      };
    });

  return {
    totalQuestoes,
    alunos,
    turmas: turmas ?? [],
  };
}



const CITY_DESCONHECIDA = "Sem município";

function cidadeDaEscola(escola: any): string {
  return (escola?.city ?? "").trim() || CITY_DESCONHECIDA;
}

type SchoolPad = {
  school_id: string;
  name: string;
  faixas: Faixas;
  total: number;
  turmas: Map<string, { turma_id: string; name: string; faixas: Faixas; total: number }>;
};

/** Padrão de desempenho — agregado por cidade, escola e turma. */
export const getPadraoDesempenho = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    const scopeSchoolId = await getScopeSchoolId(context.supabase, context.userId);
    const scopeTurmaIds = await getScopeTurmaIds(context.supabase, context.userId);
    const { alunos } = await carregarDataset(context.supabase, data.simuladoId, { scopeSchoolId, scopeTurmaIds });

    const porCidade = new Map<
      string,
      {
        city: string;
        faixas: Faixas;
        total: number;
        escolas: Map<string, SchoolPad>;
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
          turmas: new Map(),
        };
        bucket.escolas.set(schoolId, sb);
      }
      sb.faixas[fx] += 1;
      sb.total += 1;

      const tid = a.turma_id ?? "sem-turma";
      let tb = sb.turmas.get(tid);
      if (!tb) {
        tb = {
          turma_id: tid,
          name: a.turma?.nome ?? "Sem turma",
          faixas: { muito_critico: 0, critico: 0, intermediario: 0, adequado: 0 },
          total: 0,
        };
        sb.turmas.set(tid, tb);
      }
      tb.faixas[fx] += 1;
      tb.total += 1;
    }

    return Array.from(porCidade.values())
      .map((c) => ({
        city: c.city,
        total: c.total,
        faixas: c.faixas,
        escolas: Array.from(c.escolas.values())
          .map((e) => ({
            school_id: e.school_id,
            name: e.name,
            faixas: e.faixas,
            total: e.total,
            turmas: Array.from(e.turmas.values()).sort((a, b) => a.name.localeCompare(b.name)),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.city.localeCompare(b.city));
  });

/** Conclusão — finalizou (≥1 resposta) vs. matriculados (turma.matricula_atual). */
export const getConclusao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    const scopeSchoolId = await getScopeSchoolId(context.supabase, context.userId);
    const scopeTurmaIds = await getScopeTurmaIds(context.supabase, context.userId);
    const { alunos, turmas } = await carregarDataset(context.supabase, data.simuladoId, { scopeSchoolId, scopeTurmaIds });

    const finPorTurma = new Map<string, number>();
    for (const a of alunos) {
      if (a.respondidas >= 1) {
        finPorTurma.set(a.turma_id, (finPorTurma.get(a.turma_id) ?? 0) + 1);
      }
    }

    const porCidade = new Map<
      string,
      {
        city: string;
        finalizaram: number;
        matriculados: number;
        escolas: Map<
          string,
          {
            school_id: string;
            name: string;
            finalizaram: number;
            matriculados: number;
            turmas: Array<{
              turma_id: string;
              name: string;
              finalizaram: number;
              matriculados: number;
            }>;
          }
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
          turmas: [],
        };
        bucket.escolas.set(sid, sb);
      }
      sb.finalizaram += fin;
      sb.matriculados += mat;
      sb.turmas.push({
        turma_id: t.id,
        name: t.nome ?? "Sem turma",
        finalizaram: fin,
        matriculados: mat,
      });
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
            turmas: e.turmas
              .map((t) => ({
                ...t,
                nao_finalizaram: Math.max(0, t.matriculados - t.finalizaram),
              }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.city.localeCompare(b.city));
  });

/** Lista as disciplinas cadastradas nas questões de um simulado. */
export const listDisciplinasSimulado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("questoes")
      .select("disciplina")
      .eq("simulado_id", data.simuladoId);
    if (error) throw error;
    const set = new Set<string>();
    for (const r of rows ?? []) {
      const v = String((r as any).disciplina ?? "").trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

/** Acerto Médio — % de acerto vs % de erro (sobre respostas marcadas). */
export const getAcertoMedio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { simuladoId: string; disciplina?: string | null }) =>
    z
      .object({
        simuladoId: z.string().uuid(),
        disciplina: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const scopeSchoolId = await getScopeSchoolId(context.supabase, context.userId);
    const scopeTurmaIds = await getScopeTurmaIds(context.supabase, context.userId);
    const { alunos } = await carregarDataset(context.supabase, data.simuladoId, {
      disciplina: data.disciplina ?? null,
      scopeSchoolId,
      scopeTurmaIds,
    });


    const porCidade = new Map<
      string,
      {
        city: string;
        acertos: number;
        respondidas: number;
        escolas: Map<
          string,
          {
            school_id: string;
            name: string;
            acertos: number;
            respondidas: number;
            turmas: Map<
              string,
              { turma_id: string; name: string; acertos: number; respondidas: number }
            >;
          }
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
          turmas: new Map(),
        };
        bucket.escolas.set(sid, sb);
      }
      sb.acertos += a.acertos;
      sb.respondidas += a.respondidas;
      const tid = a.turma_id ?? "sem-turma";
      let tb = sb.turmas.get(tid);
      if (!tb) {
        tb = {
          turma_id: tid,
          name: a.turma?.nome ?? "Sem turma",
          acertos: 0,
          respondidas: 0,
        };
        sb.turmas.set(tid, tb);
      }
      tb.acertos += a.acertos;
      tb.respondidas += a.respondidas;
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
            school_id: e.school_id,
            name: e.name,
            acertos: e.acertos,
            erros: Math.max(0, e.respondidas - e.acertos),
            pct_acerto: pct(e.acertos, e.respondidas),
            pct_erro: pct(e.respondidas - e.acertos, e.respondidas),
            turmas: Array.from(e.turmas.values())
              .map((t) => ({
                turma_id: t.turma_id,
                name: t.name,
                acertos: t.acertos,
                erros: Math.max(0, t.respondidas - t.acertos),
                pct_acerto: pct(t.acertos, t.respondidas),
                pct_erro: pct(t.respondidas - t.acertos, t.respondidas),
              }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.city.localeCompare(b.city));
  });

/** Resultados individuais por aluno, com filtros aplicados no cliente. */
export const getResultadosAlunos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    const scopeSchoolId = await getScopeSchoolId(context.supabase, context.userId);
    const scopeTurmaIds = await getScopeTurmaIds(context.supabase, context.userId);
    const { alunos, totalQuestoes } = await carregarDataset(
      context.supabase,
      data.simuladoId,
      { scopeSchoolId, scopeTurmaIds },
    );

    return {
      totalQuestoes,
      alunos: alunos
        .map((a) => {
          const fx = faixaDeAcertos(a.acertos);
          const pct = totalQuestoes > 0 ? (a.acertos / totalQuestoes) * 100 : 0;
          return {
            turma_id: a.turma_id,
            turma_nome: a.turma?.nome ?? "—",
            numero_chamada: a.numero_chamada,
            nome: a.nome,
            acertos: a.acertos,
            respondidas: a.respondidas,
            total_questoes: totalQuestoes,
            pct_acerto: Number(pct.toFixed(1)),
            padrao: fx as
              | "muito_critico"
              | "critico"
              | "intermediario"
              | "adequado",
            school_id: a.escola?.id ?? null,
            school_name: a.escola?.name ?? "Sem escola",
            city: cidadeDaEscola(a.escola),
          };
        })
        .sort(
          (a, b) =>
            a.school_name.localeCompare(b.school_name) ||
            a.turma_nome.localeCompare(b.turma_nome) ||
            (a.nome ?? "").localeCompare(b.nome ?? "") ||
            a.numero_chamada - b.numero_chamada,
        ),
    };
  });

/** Gabarito de um aluno: todas as questões do simulado com a alternativa do aluno e a correta. */
export const getGabaritoAluno = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { simuladoId: string; turmaId: string; numeroChamada: number }) =>
    z
      .object({
        simuladoId: z.string().uuid(),
        turmaId: z.string().uuid(),
        numeroChamada: z.number().int(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: questoes, error: qErr } = await supabaseAdmin
      .from("questoes")
      .select("id, numero, resposta_correta, anulada")
      .eq("simulado_id", data.simuladoId)
      .order("numero", { ascending: true });
    if (qErr) throw qErr;

    const { data: respostas, error: rErr } = await context.supabase
      .from("respostas_alunos")
      .select("questao_id, resposta_escolhida, nome")
      .eq("simulado_id", data.simuladoId)
      .eq("turma_id", data.turmaId)
      .eq("numero_chamada", data.numeroChamada);
    if (rErr) throw rErr;

    const escolhaPorQ = new Map<string, string>();
    let nome: string | null = null;
    for (const r of respostas ?? []) {
      escolhaPorQ.set(r.questao_id, String(r.resposta_escolhida ?? "").toUpperCase());
      if (!nome && r.nome) nome = r.nome;
    }

    let acertos = 0;
    const itens = (questoes ?? []).map((q: any, idx: number) => {
      const escolhida = escolhaPorQ.get(q.id) ?? null;
      const correta = String(q.resposta_correta ?? "").toUpperCase();
      const isAnulada = !!q.anulada;
      const isCorrect = isAnulada || (escolhida && escolhida === correta);
      if (isCorrect) acertos += 1;
      return {
        numero: q.numero ?? idx + 1,
        escolhida,
        correta,
        anulada: isAnulada,
        status: isAnulada
          ? ("anulada" as const)
          : !escolhida
            ? ("branco" as const)
            : escolhida === correta
              ? ("certo" as const)
              : ("errado" as const),
      };
    });

    return { nome, acertos, total: itens.length, itens };
  });

/** Relatório por questão: acertos, erros, brancos, % e disciplina. */
export const getRelatorioQuestoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { simuladoId: string; escolaId?: string | null; turmaId?: string | null }) =>
    z
      .object({
        simuladoId: z.string().uuid(),
        escolaId: z.string().uuid().nullable().optional(),
        turmaId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: questoes, error: qErr } = await supabaseAdmin
      .from("questoes")
      .select("id, numero, resposta_correta, anulada, disciplina")
      .eq("simulado_id", data.simuladoId)
      .order("numero", { ascending: true });
    if (qErr) throw qErr;

    const { data: aggRows, error: aggErr } = await supabaseAdmin.rpc(
      "rel_questoes_agg" as any,
      {
        p_simulado: data.simuladoId,
        p_turma: data.turmaId ?? null,
        p_escola: data.turmaId ? null : (data.escolaId ?? null),
      } as any,
    );
    if (aggErr) throw aggErr;

    const stats = new Map<string, { acertos: number; erros: number; brancos: number }>();
    for (const q of questoes ?? []) {
      stats.set(q.id, { acertos: 0, erros: 0, brancos: 0 });
    }
    for (const r of (aggRows ?? []) as any[]) {
      stats.set(r.questao_id, {
        acertos: Number(r.acertos ?? 0),
        erros: Number(r.erros ?? 0),
        brancos: Number(r.brancos ?? 0),
      });
    }


    return (questoes ?? []).map((q: any, idx: number) => {
      const s = stats.get(q.id) ?? { acertos: 0, erros: 0, brancos: 0 };
      const respondidas = s.acertos + s.erros;
      const pct = respondidas > 0 ? Number(((s.acertos / respondidas) * 100).toFixed(1)) : 0;
      let padrao: "muito_critico" | "critico" | "intermediario" | "adequado";
      if (pct <= 25) padrao = "muito_critico";
      else if (pct <= 50) padrao = "critico";
      else if (pct <= 75) padrao = "intermediario";
      else padrao = "adequado";
      return {
        questao_id: q.id,
        numero: q.numero ?? idx + 1,
        disciplina: (q.disciplina ?? null) as string | null,
        anulada: !!q.anulada,
        acertos: s.acertos,
        erros: s.erros,
        brancos: s.brancos,
        total_respondentes: s.acertos + s.erros + s.brancos,
        pct_acerto: pct,
        padrao,
      };
    });
  });



