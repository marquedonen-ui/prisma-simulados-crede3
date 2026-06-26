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
    const resp = await fetchAllRows<any>(() =>
      context.supabase
        .from("respostas_alunos")
        .select("simulado_id, turma_id, numero_chamada")
        .in("simulado_id", ids)
        .not("turma_id", "is", null),
    );
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
  // Use service role to read the answer key (resposta_correta) without exposing
  // it via RLS to professor_responsavel/gestor. Callers must enforce role checks first.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: questoes, error: qErr } = await supabaseAdmin
    .from("questoes")
    .select("id, resposta_correta, anulada")
    .eq("simulado_id", simuladoId);
  if (qErr) throw qErr;
  const correct = new Map<string, string>(
    (questoes ?? []).map((q: any) => [q.id, q.resposta_correta]),
  );
  const anulada = new Map<string, boolean>(
    (questoes ?? []).map((q: any) => [q.id, !!q.anulada]),
  );

  const totalQuestoes = (questoes ?? []).length;

  const respostas = await fetchAllRows<any>(() =>
    supabase
      .from("respostas_alunos")
      .select("turma_id, numero_chamada, nome, questao_id, resposta_escolhida")
      .eq("simulado_id", simuladoId)
      .not("turma_id", "is", null)
      .not("numero_chamada", "is", null),
  );


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
      if (anulada.get(r.questao_id) || correct.get(r.questao_id) === alt) a.acertos += 1;
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
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { alunos } = await carregarDataset(context.supabase, data.simuladoId);

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
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { alunos, turmas } = await carregarDataset(context.supabase, data.simuladoId);

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
    await ensureProfessorOrAdmin(context.supabase, context.userId);
    const { alunos, totalQuestoes } = await carregarDataset(
      context.supabase,
      data.simuladoId,
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
      .select("id, numero, resposta_correta")
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
      const isCorrect = escolhida && escolhida === correta;
      if (isCorrect) acertos += 1;
      return {
        numero: q.numero ?? idx + 1,
        escolhida,
        correta,
        status: !escolhida
          ? ("branco" as const)
          : isCorrect
            ? ("certo" as const)
            : ("errado" as const),
      };
    });

    return { nome, acertos, total: itens.length, itens };
  });
