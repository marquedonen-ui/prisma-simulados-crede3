import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

async function ensureGlobalAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!data) throw new Error("Acesso restrito ao administrador global.");
}

type ImportacaoAgg = {
  simulado_id: string;
  turma_id: string;
  respostas: number | string | null;
  alunos: number | string | null;
  ultima: string | null;
};

export const getAcompanhamentoAvaliacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureGlobalAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [schools, turmas, simulados, importacoes, ausentes, fechados] = await Promise.all([
      fetchAllRows<any>(() =>
        supabaseAdmin.from("schools").select("id, name, inep, city").order("name"),
      ),
      fetchAllRows<any>(() =>
        supabaseAdmin
          .from("turmas")
          .select("id, school_id, nome, ano, turno, matricula_atual")
          .order("nome"),
      ),
      fetchAllRows<any>(() =>
        supabaseAdmin
          .from("diagnostic_assessments")
          .select("id, offer, subject, grade, created_at")
          .order("created_at", { ascending: false }),
      ),
      fetchAllRows<ImportacaoAgg>(() =>
        supabaseAdmin.rpc("rel_importacoes_agg").order("ultima", { ascending: false }),
      ),
      fetchAllRows<any>(() =>
        supabaseAdmin
          .from("alunos_ausentes")
          .select("simulado_id, turma_id, numero_chamada"),
      ),
      fetchAllRows<any>(() =>
        supabaseAdmin.from("lotes_fechados").select("simulado_id, turma_id, fechado_em"),
      ),
    ]);

    const schoolById = new Map(schools.map((school) => [school.id, school]));
    const importacaoByKey = new Map(
      importacoes.map((row) => [`${row.simulado_id}::${row.turma_id}`, row]),
    );
    const ausentesByKey = new Map<string, Set<number>>();
    for (const row of ausentes) {
      const key = `${row.simulado_id}::${row.turma_id}`;
      const numeros = ausentesByKey.get(key) ?? new Set<number>();
      numeros.add(Number(row.numero_chamada));
      ausentesByKey.set(key, numeros);
    }
    const fechadoByKey = new Map(
      fechados.map((row) => [`${row.simulado_id}::${row.turma_id}`, row.fechado_em]),
    );

    const registros = simulados.flatMap((simulado) =>
      turmas.map((turma) => {
        const school = schoolById.get(turma.school_id);
        const key = `${simulado.id}::${turma.id}`;
        const importacao = importacaoByKey.get(key);
        const quantidadeAusentes = ausentesByKey.get(key)?.size ?? 0;
        const avaliada = Boolean(importacao) || quantidadeAusentes > 0;
        const fechadoEm = fechadoByKey.get(key) ?? null;

        return {
          simulado_id: simulado.id,
          simulado: [simulado.offer, simulado.subject, simulado.grade].filter(Boolean).join(" · "),
          escola_id: turma.school_id,
          escola: school?.name ?? "Escola não identificada",
          inep: school?.inep ?? "—",
          municipio: school?.city ?? null,
          turma_id: turma.id,
          turma: turma.nome,
          ano: turma.ano,
          turno: turma.turno,
          matricula_atual: turma.matricula_atual ?? null,
          status: avaliada ? ("avaliada" as const) : ("pendente" as const),
          alunos: Number(importacao?.alunos ?? 0),
          ausentes: quantidadeAusentes,
          respostas: Number(importacao?.respostas ?? 0),
          ultima_importacao: importacao?.ultima ?? null,
          fechado: fechadoEm !== null,
          fechado_em: fechadoEm,
        };
      }),
    );

    return { schools, simulados, registros };
  });