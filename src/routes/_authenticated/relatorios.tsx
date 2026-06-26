import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { BarChart3, Loader2, ArrowLeft } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import {
  listSimuladosComRespostas,
  getPadraoDesempenho,
  getConclusao,
  getAcertoMedio,
  listDisciplinasSimulado,
  getMyReportScope,
} from "@/lib/relatorios.functions";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — PRISMA" }] }),
  component: Page,
});

// Cores das faixas
const COR_MUITO_CRITICO = "#ef4444"; // vermelho
const COR_CRITICO = "#eab308"; // amarelo
const COR_INTERMEDIARIO = "#22c55e"; // verde
const COR_ADEQUADO = "#3b82f6"; // azul

const COR_FINALIZOU = "#22c55e";
const COR_NAO_FINALIZOU = "#94a3b8";

const COR_ACERTO = "#3b82f6";
const COR_ERRO = "#ef4444";

function Page() {
  const listSimFn = useServerFn(listSimuladosComRespostas);
  const getPadFn = useServerFn(getPadraoDesempenho);
  const getConFn = useServerFn(getConclusao);
  const getAcFn = useServerFn(getAcertoMedio);
  const listDiscFn = useServerFn(listDisciplinasSimulado);
  const getScopeFn = useServerFn(getMyReportScope);

  const scopeQ = useQuery({ queryKey: ["report-scope"], queryFn: () => getScopeFn() });
  const scoped = !!scopeQ.data?.scoped;

  const [simuladoId, setSimuladoId] = useState("");
  const [acDisciplina, setAcDisciplina] = useState<string>("__all__");

  const simQ = useQuery({ queryKey: ["rel-sims"], queryFn: () => listSimFn() });
  const padQ = useQuery({
    queryKey: ["padrao", simuladoId],
    queryFn: () => getPadFn({ data: { simuladoId } }),
    enabled: !!simuladoId,
  });
  const conQ = useQuery({
    queryKey: ["conclusao", simuladoId],
    queryFn: () => getConFn({ data: { simuladoId } }),
    enabled: !!simuladoId,
  });
  const discQ = useQuery({
    queryKey: ["disciplinas-sim", simuladoId],
    queryFn: () => listDiscFn({ data: { simuladoId } }),
    enabled: !!simuladoId,
  });
  const acQ = useQuery({
    queryKey: ["acerto", simuladoId, acDisciplina],
    queryFn: () =>
      getAcFn({
        data: {
          simuladoId,
          disciplina: acDisciplina === "__all__" ? null : acDisciplina,
        },
      }),
    enabled: !!simuladoId,
  });


  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-10">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-primary">
          <BarChart3 className="h-3.5 w-3.5" /> Relatórios
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          {scoped
            ? `Relatórios da escola${scopeQ.data?.schoolName ? ` — ${scopeQ.data.schoolName}` : ""}`
            : "Relatórios por município, escola e padrão de desempenho"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {scoped
            ? "Os gráficos abaixo mostram apenas as turmas da sua escola."
            : "Selecione um simulado e clique em uma barra de município para abrir o detalhamento por escola."}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Simulado</CardTitle>
          <CardDescription>Escolha um simulado com respostas importadas.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-1.5">
            <Label>Simulado</Label>
            <Select value={simuladoId} onValueChange={setSimuladoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {(simQ.data ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.offer} · {s.subject} · {s.grade} ({s.alunos_distintos} aluno(s))
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!simuladoId && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {(simQ.data?.length ?? 0) === 0
              ? "Nenhum simulado com respostas importadas ainda. Importe um cartão-resposta em Administração."
              : "Selecione um simulado acima para ver os relatórios."}
          </CardContent>
        </Card>
      )}

      {simuladoId && (
        <div className="space-y-6">
          <PadraoDesempenhoPainel
            isLoading={padQ.isLoading}
            data={padQ.data ?? []}
            scoped={scoped}
          />
          <ConclusaoPainel isLoading={conQ.isLoading} data={conQ.data ?? []} scoped={scoped} />
          <AcertoMedioPainel
            isLoading={acQ.isLoading}
            data={acQ.data ?? []}
            disciplinas={discQ.data ?? []}
            disciplina={acDisciplina}
            onDisciplinaChange={setAcDisciplina}
            scoped={scoped}
          />

        </div>
      )}
    </div>
  );
}

/* =================== Painel 1: Padrão de Desempenho =================== */

type SchoolPad = {
  school_id: string;
  name: string;
  total: number;
  faixas: { muito_critico: number; critico: number; intermediario: number; adequado: number };
  turmas: Array<{
    turma_id: string;
    name: string;
    total: number;
    faixas: { muito_critico: number; critico: number; intermediario: number; adequado: number };
  }>;
};

function PadraoDesempenhoPainel({
  isLoading,
  data,
  scoped = false,
}: {
  isLoading: boolean;
  data: Array<{
    city: string;
    total: number;
    faixas: { muito_critico: number; critico: number; intermediario: number; adequado: number };
    escolas: SchoolPad[];
  }>;
  scoped?: boolean;
}) {
  const [cidade, setCidade] = useState<string | null>(null);
  const [escolaId, setEscolaId] = useState<string | null>(null);
  const scopedCidade = scoped ? (data[0]?.city ?? null) : null;
  const scopedEscola = scoped ? (data[0]?.escolas?.[0] ?? null) : null;
  const cidadeData = scoped ? data[0] ?? null : cidade ? data.find((c) => c.city === cidade) : null;
  const escolaData = scoped
    ? scopedEscola
    : cidadeData && escolaId
      ? cidadeData.escolas.find((e) => e.school_id === escolaId)
      : null;

  const chartData = useMemo(() => {
    if (escolaData) {
      return escolaData.turmas.map((t) => toPct(t.name, t.faixas, t.total));
    }
    if (cidadeData) {
      return cidadeData.escolas.map((e) => toPct(e.name, e.faixas, e.total, e.school_id));
    }
    const rows = data.map((c) => toPct(c.city, c.faixas, c.total));
    const geral = data.reduce(
      (acc, c) => {
        acc.total += c.total;
        acc.faixas.muito_critico += c.faixas.muito_critico;
        acc.faixas.critico += c.faixas.critico;
        acc.faixas.intermediario += c.faixas.intermediario;
        acc.faixas.adequado += c.faixas.adequado;
        return acc;
      },
      { total: 0, faixas: { muito_critico: 0, critico: 0, intermediario: 0, adequado: 0 } },
    );
    if (geral.total > 0) rows.push(toPct("CREDE 3", geral.faixas, geral.total));
    return rows;
  }, [data, cidadeData, escolaData]);


  const onBarClick = (d: any) => {
    if (scoped || escolaData) return;
    if (cidadeData) {
      const e = cidadeData.escolas.find((x) => x.name === d.label);
      if (e) setEscolaId(e.school_id);
    } else {
      setCidade(d.label);
    }
  };
  const onBack = scoped
    ? undefined
    : escolaData
      ? () => setEscolaId(null)
      : cidade
        ? () => setCidade(null)
        : undefined;
  const backLabel = escolaData ? "Voltar para escolas" : "Voltar para municípios";
  const description = scoped
    ? `Turmas da escola${escolaData ? ` ${escolaData.name}` : ""}. Faixas: 0–11 Muito Crítico · 12–22 Crítico · 23–34 Intermediário · 35–45 Adequado.`
    : escolaData
      ? `Turmas da escola ${escolaData.name}. Faixas: 0–11 Muito Crítico · 12–22 Crítico · 23–34 Intermediário · 35–45 Adequado.`
      : cidade
        ? `Escolas do município de ${cidade}. Clique em uma barra para ver as turmas.`
        : "Por município. Clique em uma barra para ver as escolas. Faixas: 0–11 Muito Crítico · 12–22 Crítico · 23–34 Intermediário · 35–45 Adequado.";

  const drillable = !scoped && !escolaData;
  void scopedCidade;

  return (
    <PainelCard
      title="% de Alunos por Padrão de Desempenho"
      description={description}
      onBack={onBack}
      backLabel={backLabel}
      isLoading={isLoading}
      empty={chartData.length === 0}
    >
      <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 44)}>
        <BarChart
          data={chartData}
          layout="vertical"
          stackOffset="expand"
          margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
        >
          <XAxis type="number" tickFormatter={(v) => `${Math.round(v * 100)}%`} />
          <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 12 }} />
          <Tooltip formatter={pctTooltip} />
          <Legend />
          {(["Muito Crítico", "Crítico", "Intermediário", "Adequado"] as const).map((k) => (
            <Bar
              key={k}
              dataKey={k}
              stackId="a"
              fill={
                k === "Muito Crítico"
                  ? COR_MUITO_CRITICO
                  : k === "Crítico"
                    ? COR_CRITICO
                    : k === "Intermediário"
                      ? COR_INTERMEDIARIO
                      : COR_ADEQUADO
              }
              onClick={onBarClick}
              cursor={drillable ? "pointer" : "default"}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}

function toPct(
  label: string,
  faixas: { muito_critico: number; critico: number; intermediario: number; adequado: number },
  total: number,
  _id?: string,
) {
  const t = total || 1;
  return {
    label,
    total,
    "Muito Crítico": faixas.muito_critico / t,
    Crítico: faixas.critico / t,
    Intermediário: faixas.intermediario / t,
    Adequado: faixas.adequado / t,
    _abs: faixas,
  };
}

function pctTooltip(value: any, name: any, item: any) {
  const abs = item?.payload?._abs?.[
    name === "Muito Crítico"
      ? "muito_critico"
      : name === "Crítico"
        ? "critico"
        : name === "Intermediário"
          ? "intermediario"
          : "adequado"
  ];
  const pct = typeof value === "number" ? `${(value * 100).toFixed(1)}%` : value;
  return [`${pct}${abs !== undefined ? ` (${abs})` : ""}`, name];
}

/* =================== Painel 2: Conclusão =================== */

function ConclusaoPainel({
  isLoading,
  data,
  scoped = false,
}: {
  isLoading: boolean;
  data: Array<{
    city: string;
    finalizaram: number;
    nao_finalizaram: number;
    matriculados: number;
    escolas: Array<{
      school_id: string;
      name: string;
      finalizaram: number;
      nao_finalizaram: number;
      matriculados: number;
      turmas: Array<{
        turma_id: string;
        name: string;
        finalizaram: number;
        nao_finalizaram: number;
        matriculados: number;
      }>;
    }>;
  }>;
  scoped?: boolean;
}) {
  const [cidade, setCidade] = useState<string | null>(null);
  const [escolaId, setEscolaId] = useState<string | null>(null);
  const cidadeData = scoped ? data[0] ?? null : cidade ? data.find((c) => c.city === cidade) : null;
  const escolaData = scoped
    ? (data[0]?.escolas?.[0] ?? null)
    : cidadeData && escolaId
      ? cidadeData.escolas.find((e) => e.school_id === escolaId)
      : null;

  const chartData = useMemo(() => {
    if (escolaData) {
      return escolaData.turmas.map((t) => ({
        label: t.name,
        Finalizaram: t.finalizaram,
        "Não finalizaram": t.nao_finalizaram,
        _total: t.matriculados || t.finalizaram + t.nao_finalizaram,
      }));
    }
    if (cidadeData) {
      return cidadeData.escolas.map((e) => ({
        label: e.name,
        Finalizaram: e.finalizaram,
        "Não finalizaram": e.nao_finalizaram,
        _total: e.matriculados || e.finalizaram + e.nao_finalizaram,
      }));
    }
    const rows = data.map((c) => ({
      label: c.city,
      Finalizaram: c.finalizaram,
      "Não finalizaram": c.nao_finalizaram,
      _total: c.matriculados || c.finalizaram + c.nao_finalizaram,
    }));
    const geral = data.reduce(
      (acc, c) => {
        acc.fin += c.finalizaram;
        acc.naofin += c.nao_finalizaram;
        acc.mat += c.matriculados || c.finalizaram + c.nao_finalizaram;
        return acc;
      },
      { fin: 0, naofin: 0, mat: 0 },
    );
    if (geral.fin + geral.naofin > 0) {
      rows.push({
        label: "CREDE 3",
        Finalizaram: geral.fin,
        "Não finalizaram": geral.naofin,
        _total: geral.mat || geral.fin + geral.naofin,
      });
    }
    return rows;
  }, [data, cidadeData, escolaData]);


  const onBarClick = (d: any) => {
    if (scoped || escolaData) return;
    if (cidadeData) {
      const e = cidadeData.escolas.find((x) => x.name === d.label);
      if (e) setEscolaId(e.school_id);
    } else {
      setCidade(d.label);
    }
  };
  const onBack = scoped
    ? undefined
    : escolaData
      ? () => setEscolaId(null)
      : cidade
        ? () => setCidade(null)
        : undefined;
  const backLabel = escolaData ? "Voltar para escolas" : "Voltar para municípios";
  const description = scoped
    ? `Turmas da escola${escolaData ? ` ${escolaData.name}` : ""}. Base: matrícula atual cadastrada em cada turma.`
    : escolaData
      ? `Turmas da escola ${escolaData.name}. Base: matrícula atual cadastrada em cada turma.`
      : cidade
        ? `Escolas do município de ${cidade}. Clique em uma barra para ver as turmas.`
        : "Por município. Clique em uma barra para abrir as escolas. Base: matrícula atual cadastrada em cada turma.";
  const drillable = !scoped && !escolaData;

  return (
    <PainelCard
      title="% de Alunos que Finalizaram a Prova"
      description={description}
      onBack={onBack}
      backLabel={backLabel}
      isLoading={isLoading}
      empty={chartData.length === 0}
    >
      <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 44)}>
        <BarChart
          data={chartData}
          layout="vertical"
          stackOffset="expand"
          margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
        >
          <XAxis type="number" tickFormatter={(v) => `${Math.round(v * 100)}%`} />
          <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: any, name: any, item: any) => {
              const total = item?.payload?._total ?? 1;
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
              return [`${pct}% (${value})`, name];
            }}
          />
          <Legend />
          <Bar
            dataKey="Finalizaram"
            stackId="b"
            fill={COR_FINALIZOU}
            onClick={onBarClick}
            cursor={drillable ? "pointer" : "default"}
          />
          <Bar
            dataKey="Não finalizaram"
            stackId="b"
            fill={COR_NAO_FINALIZOU}
            onClick={onBarClick}
            cursor={drillable ? "pointer" : "default"}
          />
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}

/* =================== Painel 3: Acerto Médio =================== */

function AcertoMedioPainel({
  isLoading,
  data,
  disciplinas,
  disciplina,
  onDisciplinaChange,
  scoped = false,
}: {
  isLoading: boolean;
  data: Array<{
    city: string;
    pct_acerto: number;
    pct_erro: number;
    acertos: number;
    erros: number;
    escolas: Array<{
      school_id: string;
      name: string;
      pct_acerto: number;
      pct_erro: number;
      acertos: number;
      erros: number;
      turmas: Array<{
        turma_id: string;
        name: string;
        pct_acerto: number;
        pct_erro: number;
        acertos: number;
        erros: number;
      }>;
    }>;
  }>;
  disciplinas: string[];
  disciplina: string;
  onDisciplinaChange: (v: string) => void;
  scoped?: boolean;
}) {

  const [cidade, setCidade] = useState<string | null>(null);
  const [escolaId, setEscolaId] = useState<string | null>(null);
  const cidadeData = scoped ? data[0] ?? null : cidade ? data.find((c) => c.city === cidade) : null;
  const escolaData = scoped
    ? (data[0]?.escolas?.[0] ?? null)
    : cidadeData && escolaId
      ? cidadeData.escolas.find((e) => e.school_id === escolaId)
      : null;

  const chartData = useMemo(() => {
    if (escolaData) {
      return escolaData.turmas.map((t) => ({
        label: t.name,
        "% Acerto": t.pct_acerto,
        "% Erro": t.pct_erro,
        _acertos: t.acertos,
        _erros: t.erros,
      }));
    }
    if (cidadeData) {
      return cidadeData.escolas.map((e) => ({
        label: e.name,
        "% Acerto": e.pct_acerto,
        "% Erro": e.pct_erro,
        _acertos: e.acertos,
        _erros: e.erros,
      }));
    }
    const rows = data.map((c) => ({
      label: c.city,
      "% Acerto": c.pct_acerto,
      "% Erro": c.pct_erro,
      _acertos: c.acertos,
      _erros: c.erros,
    }));
    const totA = data.reduce((s, c) => s + c.acertos, 0);
    const totE = data.reduce((s, c) => s + c.erros, 0);
    const tot = totA + totE;
    if (tot > 0) {
      const pa = Math.round((totA / tot) * 1000) / 10;
      rows.push({
        label: "CREDE 3",
        "% Acerto": pa,
        "% Erro": Math.round((100 - pa) * 10) / 10,
        _acertos: totA,
        _erros: totE,
      });
    }
    return rows;

  }, [data, cidadeData, escolaData]);

  const onBarClick = (d: any) => {
    if (scoped || escolaData) return;
    if (cidadeData) {
      const e = cidadeData.escolas.find((x) => x.name === d.label);
      if (e) setEscolaId(e.school_id);
    } else {
      setCidade(d.label);
    }
  };
  const onBack = scoped
    ? undefined
    : escolaData
      ? () => setEscolaId(null)
      : cidade
        ? () => setCidade(null)
        : undefined;
  const backLabel = escolaData ? "Voltar para escolas" : "Voltar para municípios";
  const description = scoped
    ? `Turmas da escola${escolaData ? ` ${escolaData.name}` : ""}.`
    : escolaData
      ? `Turmas da escola ${escolaData.name}.`
      : cidade
        ? `Escolas do município de ${cidade}. Clique em uma barra para ver as turmas.`
        : "Por município. Clique em uma barra para abrir as escolas.";
  const drillable = !scoped && !escolaData;

  return (
    <PainelCard
      title="Percentual de Acerto Médio na Oferta"
      description={description}
      onBack={onBack}
      backLabel={backLabel}
      isLoading={isLoading}
      empty={chartData.length === 0}
    >
      <div className="mb-4 max-w-xs space-y-1.5">
        <Label>Disciplina</Label>
        <Select value={disciplina} onValueChange={onDisciplinaChange}>
          <SelectTrigger>
            <SelectValue placeholder="Todas as disciplinas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as disciplinas</SelectItem>
            {disciplinas.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 44)}>
        <BarChart
          data={chartData}
          layout="vertical"
          stackOffset="expand"
          margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
        >
          <XAxis type="number" tickFormatter={(v) => `${Math.round(v * 100)}%`} />
          <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: any, name: any, item: any) => {
              const abs = name === "% Acerto" ? item?.payload?._acertos : item?.payload?._erros;
              return [`${value}%${abs !== undefined ? ` (${abs})` : ""}`, name];
            }}
          />
          <Legend />
          <Bar
            dataKey="% Acerto"
            stackId="c"
            fill={COR_ACERTO}
            onClick={onBarClick}
            cursor={drillable ? "pointer" : "default"}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COR_ACERTO} />
            ))}
          </Bar>
          <Bar
            dataKey="% Erro"
            stackId="c"
            fill={COR_ERRO}
            onClick={onBarClick}
            cursor={drillable ? "pointer" : "default"}
          />
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}

/* =================== Helper card =================== */

function PainelCard({
  title,
  description,
  onBack,
  backLabel,
  isLoading,
  empty,
  children,
}: {
  title: string;
  description: string;
  onBack?: () => void;
  backLabel?: string;
  isLoading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> {backLabel ?? "Voltar"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : empty ? (
          <div className="py-10 text-center text-muted-foreground">Sem dados para exibir.</div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
