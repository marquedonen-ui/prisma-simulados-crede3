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

  const [simuladoId, setSimuladoId] = useState("");

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
  const acQ = useQuery({
    queryKey: ["acerto", simuladoId],
    queryFn: () => getAcFn({ data: { simuladoId } }),
    enabled: !!simuladoId,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-10">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-primary">
          <BarChart3 className="h-3.5 w-3.5" /> Relatórios
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          Relatórios por município, escola e padrão de desempenho
        </h1>
        <p className="mt-1 text-muted-foreground">
          Selecione um simulado e clique em uma barra de município para abrir o detalhamento por escola.
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
          />
          <ConclusaoPainel isLoading={conQ.isLoading} data={conQ.data ?? []} />
          <AcertoMedioPainel isLoading={acQ.isLoading} data={acQ.data ?? []} />
        </div>
      )}
    </div>
  );
}

/* =================== Painel 1: Padrão de Desempenho =================== */

function PadraoDesempenhoPainel({
  isLoading,
  data,
}: {
  isLoading: boolean;
  data: Array<{
    city: string;
    total: number;
    faixas: { muito_critico: number; critico: number; intermediario: number; adequado: number };
    escolas: Array<{
      school_id: string;
      name: string;
      total: number;
      faixas: { muito_critico: number; critico: number; intermediario: number; adequado: number };
    }>;
  }>;
}) {
  const [cidade, setCidade] = useState<string | null>(null);
  const cidadeData = cidade ? data.find((c) => c.city === cidade) : null;

  const chartData = useMemo(() => {
    if (cidadeData) {
      return cidadeData.escolas.map((e) => toPct(e.name, e.faixas, e.total));
    }
    return data.map((c) => toPct(c.city, c.faixas, c.total));
  }, [data, cidadeData]);

  return (
    <PainelCard
      title="% de Alunos por Padrão de Desempenho"
      description={
        cidade
          ? `Escolas do município de ${cidade}. Faixas: 0–11 Muito Crítico · 12–22 Crítico · 23–34 Intermediário · 35–45 Adequado.`
          : "Por município. Clique em uma barra para ver as escolas. Faixas: 0–11 Muito Crítico · 12–22 Crítico · 23–34 Intermediário · 35–45 Adequado."
      }
      onBack={cidade ? () => setCidade(null) : undefined}
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
          <Bar
            dataKey="Muito Crítico"
            stackId="a"
            fill={COR_MUITO_CRITICO}
            onClick={(d: any) => !cidade && setCidade(d.label)}
            cursor={cidade ? "default" : "pointer"}
          />
          <Bar
            dataKey="Crítico"
            stackId="a"
            fill={COR_CRITICO}
            onClick={(d: any) => !cidade && setCidade(d.label)}
            cursor={cidade ? "default" : "pointer"}
          />
          <Bar
            dataKey="Intermediário"
            stackId="a"
            fill={COR_INTERMEDIARIO}
            onClick={(d: any) => !cidade && setCidade(d.label)}
            cursor={cidade ? "default" : "pointer"}
          />
          <Bar
            dataKey="Adequado"
            stackId="a"
            fill={COR_ADEQUADO}
            onClick={(d: any) => !cidade && setCidade(d.label)}
            cursor={cidade ? "default" : "pointer"}
          />
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}

function toPct(
  label: string,
  faixas: { muito_critico: number; critico: number; intermediario: number; adequado: number },
  total: number,
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
    }>;
  }>;
}) {
  const [cidade, setCidade] = useState<string | null>(null);
  const cidadeData = cidade ? data.find((c) => c.city === cidade) : null;

  const chartData = useMemo(() => {
    const rows = cidadeData
      ? cidadeData.escolas.map((e) => ({
          label: e.name,
          Finalizaram: e.finalizaram,
          "Não finalizaram": e.nao_finalizaram,
          _total: e.matriculados || e.finalizaram + e.nao_finalizaram,
        }))
      : data.map((c) => ({
          label: c.city,
          Finalizaram: c.finalizaram,
          "Não finalizaram": c.nao_finalizaram,
          _total: c.matriculados || c.finalizaram + c.nao_finalizaram,
        }));
    return rows;
  }, [data, cidadeData]);

  return (
    <PainelCard
      title="% de Alunos que Finalizaram a Prova"
      description={
        cidade
          ? `Escolas do município de ${cidade}. Base: matrícula atual cadastrada em cada turma.`
          : "Por município. Clique em uma barra para abrir as escolas. Base: matrícula atual cadastrada em cada turma."
      }
      onBack={cidade ? () => setCidade(null) : undefined}
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
            onClick={(d: any) => !cidade && setCidade(d.label)}
            cursor={cidade ? "default" : "pointer"}
          />
          <Bar
            dataKey="Não finalizaram"
            stackId="b"
            fill={COR_NAO_FINALIZOU}
            onClick={(d: any) => !cidade && setCidade(d.label)}
            cursor={cidade ? "default" : "pointer"}
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
    }>;
  }>;
}) {
  const [cidade, setCidade] = useState<string | null>(null);
  const cidadeData = cidade ? data.find((c) => c.city === cidade) : null;

  const chartData = useMemo(() => {
    const rows = cidadeData
      ? cidadeData.escolas.map((e) => ({
          label: e.name,
          "% Acerto": e.pct_acerto,
          "% Erro": e.pct_erro,
          _acertos: e.acertos,
          _erros: e.erros,
        }))
      : data.map((c) => ({
          label: c.city,
          "% Acerto": c.pct_acerto,
          "% Erro": c.pct_erro,
          _acertos: c.acertos,
          _erros: c.erros,
        }));
    return rows;
  }, [data, cidadeData]);

  return (
    <PainelCard
      title="Percentual de Acerto Médio na Oferta"
      description={
        cidade
          ? `Escolas do município de ${cidade}.`
          : "Por município. Clique em uma barra para abrir as escolas."
      }
      onBack={cidade ? () => setCidade(null) : undefined}
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
              const abs = name === "% Acerto" ? item?.payload?._acertos : item?.payload?._erros;
              return [`${value}%${abs !== undefined ? ` (${abs})` : ""}`, name];
            }}
          />
          <Legend />
          <Bar
            dataKey="% Acerto"
            stackId="c"
            fill={COR_ACERTO}
            onClick={(d: any) => !cidade && setCidade(d.label)}
            cursor={cidade ? "default" : "pointer"}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COR_ACERTO} />
            ))}
          </Bar>
          <Bar
            dataKey="% Erro"
            stackId="c"
            fill={COR_ERRO}
            onClick={(d: any) => !cidade && setCidade(d.label)}
            cursor={cidade ? "default" : "pointer"}
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
  isLoading,
  empty,
  children,
}: {
  title: string;
  description: string;
  onBack?: () => void;
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
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para municípios
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
