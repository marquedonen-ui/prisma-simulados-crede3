import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, ClipboardCheck, Loader2 } from "lucide-react";

import { getAcompanhamentoAvaliacoes } from "@/lib/acompanhamento-avaliacoes.functions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type StatusFilter = "todas" | "avaliada" | "pendente";

type Registro = {
  simulado_id: string;
  simulado: string;
  escola_id: string;
  escola: string;
  inep: string;
  municipio: string | null;
  turma_id: string;
  turma: string;
  ano: string;
  turno: string;
  matricula_atual: number | null;
  status: "avaliada" | "pendente";
  alunos: number;
  ausentes: number;
  respostas: number;
  ultima_importacao: string | null;
  fechado: boolean;
  fechado_em: string | null;
};

function summarize(registros: Registro[]) {
  const avaliadas = registros.filter((registro) => registro.status === "avaliada").length;
  const total = registros.length;
  return {
    total,
    avaliadas,
    pendentes: total - avaliadas,
    percentual: total > 0 ? Math.round((avaliadas / total) * 100) : 0,
  };
}

function StatusFilterSelect({ value, onChange }: { value: StatusFilter; onChange: (value: StatusFilter) => void }) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as StatusFilter)}>
      <SelectTrigger className="w-full sm:w-52">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todas">Todas as situações</SelectItem>
        <SelectItem value="avaliada">Avaliadas</SelectItem>
        <SelectItem value="pendente">Pendentes</SelectItem>
      </SelectContent>
    </Select>
  );
}

function Summary({ registros }: { registros: Registro[] }) {
  const resumo = summarize(registros);
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <div className="rounded-md border p-4">
        <p className="text-xs font-medium text-muted-foreground">Total esperado</p>
        <p className="mt-1 text-2xl font-bold">{resumo.total}</p>
      </div>
      <div className="rounded-md border p-4">
        <p className="text-xs font-medium text-muted-foreground">Avaliadas</p>
        <p className="mt-1 text-2xl font-bold text-primary">{resumo.avaliadas}</p>
      </div>
      <div className="rounded-md border p-4">
        <p className="text-xs font-medium text-muted-foreground">Pendentes</p>
        <p className="mt-1 text-2xl font-bold text-destructive">{resumo.pendentes}</p>
      </div>
      <div className="rounded-md border p-4">
        <p className="text-xs font-medium text-muted-foreground">Conclusão</p>
        <p className="mt-1 text-2xl font-bold">{resumo.percentual}%</p>
        <Progress value={resumo.percentual} className="mt-2" />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Registro["status"] }) {
  return status === "avaliada" ? (
    <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Avaliada</Badge>
  ) : (
    <Badge variant="destructive" className="gap-1"><CircleAlert className="h-3 w-3" /> Pendente</Badge>
  );
}

function RecordsTable({ registros, groupColumn }: { registros: Registro[]; groupColumn: "simulado" | "escola" }) {
  if (registros.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma turma encontrada para os filtros selecionados.</p>;
  }

  return (
    <div className="overflow-auto rounded-md border">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">{groupColumn === "simulado" ? "Simulado" : "Escola"}</th>
            <th className="px-3 py-2">Turma</th>
            <th className="px-3 py-2">Situação</th>
            <th className="px-3 py-2 text-right">Alunos</th>
            <th className="px-3 py-2 text-right">Ausentes</th>
            <th className="px-3 py-2 text-right">Respostas</th>
            <th className="px-3 py-2">Última importação</th>
            <th className="px-3 py-2">Lote</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((registro) => (
            <tr key={`${registro.simulado_id}::${registro.turma_id}`} className="border-t">
              <td className="max-w-80 px-3 py-2 font-medium">
                {groupColumn === "simulado" ? registro.simulado : registro.escola}
                <span className="block text-xs font-normal text-muted-foreground">
                  {groupColumn === "simulado" ? registro.escola : `INEP ${registro.inep}`}
                </span>
              </td>
              <td className="px-3 py-2">
                {registro.turma}
                <span className="block text-xs text-muted-foreground">{registro.ano} · {registro.turno}</span>
              </td>
              <td className="px-3 py-2"><StatusBadge status={registro.status} /></td>
              <td className="px-3 py-2 text-right">{registro.alunos}</td>
              <td className="px-3 py-2 text-right">{registro.ausentes}</td>
              <td className="px-3 py-2 text-right">{registro.respostas}</td>
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                {registro.ultima_importacao ? new Date(registro.ultima_importacao).toLocaleString("pt-BR") : "—"}
              </td>
              <td className="px-3 py-2">
                {registro.status === "pendente" ? "—" : registro.fechado ? "Encerrado" : "Em aberto"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AcompanhamentoAvaliacoes() {
  const getReport = useServerFn(getAcompanhamentoAvaliacoes);
  const reportQ = useQuery({
    queryKey: ["acompanhamento-avaliacoes"],
    queryFn: () => getReport({}),
  });
  const [simuladoId, setSimuladoId] = useState("");
  const [escolaId, setEscolaId] = useState("");
  const [statusGeral, setStatusGeral] = useState<StatusFilter>("todas");
  const [statusSimulado, setStatusSimulado] = useState<StatusFilter>("todas");
  const [statusEscola, setStatusEscola] = useState<StatusFilter>("todas");

  const registros = (reportQ.data?.registros ?? []) as Registro[];
  const simulados = reportQ.data?.simulados ?? [];
  const escolas = reportQ.data?.schools ?? [];
  const selectedSimulado = simuladoId || simulados[0]?.id || "";
  const selectedEscola = escolaId || escolas[0]?.id || "";
  const filterStatus = (rows: Registro[], status: StatusFilter) =>
    status === "todas" ? rows : rows.filter((row) => row.status === status);
  const geralRows = filterStatus(registros, statusGeral);
  const simuladoRows = filterStatus(registros.filter((row) => row.simulado_id === selectedSimulado), statusSimulado);
  const escolaRows = filterStatus(registros.filter((row) => row.escola_id === selectedEscola), statusEscola);

  const porEscola = useMemo(() => {
    return escolas.map((escola) => ({ escola, ...summarize(registros.filter((row) => row.escola_id === escola.id)) }));
  }, [escolas, registros]);
  const porSimulado = useMemo(() => {
    return simulados.map((simulado) => ({ simulado, ...summarize(registros.filter((row) => row.simulado_id === simulado.id)) }));
  }, [simulados, registros]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5" /> Acompanhamento das avaliações</CardTitle>
        <CardDescription>Confira as turmas avaliadas e as que ainda aguardam o carregamento dos resultados.</CardDescription>
      </CardHeader>
      <CardContent>
        {reportQ.isLoading && <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando acompanhamento...</div>}
        {reportQ.isError && <p className="py-6 text-sm text-destructive">Não foi possível carregar o acompanhamento.</p>}
        {reportQ.data && (
          <Tabs defaultValue="geral" className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-3">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="simulado">Por simulado</TabsTrigger>
              <TabsTrigger value="escola">Por escola</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-4">
              <Summary registros={registros} />
              <div className="flex justify-end"><StatusFilterSelect value={statusGeral} onChange={setStatusGeral} /></div>
              <RecordsTable registros={geralRows} groupColumn="simulado" />
              <div className="grid gap-4 lg:grid-cols-2">
                <Breakdown title="Progresso por escola" rows={porEscola.map((row) => ({ id: row.escola.id, label: row.escola.name, ...row }))} />
                <Breakdown title="Progresso por simulado" rows={porSimulado.map((row) => ({ id: row.simulado.id, label: [row.simulado.offer, row.simulado.subject, row.simulado.grade].filter(Boolean).join(" · "), ...row }))} />
              </div>
            </TabsContent>

            <TabsContent value="simulado" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Select value={selectedSimulado} onValueChange={setSimuladoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um simulado" /></SelectTrigger>
                  <SelectContent>{simulados.map((simulado) => <SelectItem key={simulado.id} value={simulado.id}>{[simulado.offer, simulado.subject, simulado.grade].filter(Boolean).join(" · ")}</SelectItem>)}</SelectContent>
                </Select>
                <StatusFilterSelect value={statusSimulado} onChange={setStatusSimulado} />
              </div>
              <Summary registros={registros.filter((row) => row.simulado_id === selectedSimulado)} />
              <RecordsTable registros={simuladoRows} groupColumn="escola" />
            </TabsContent>

            <TabsContent value="escola" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Select value={selectedEscola} onValueChange={setEscolaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma escola" /></SelectTrigger>
                  <SelectContent>{escolas.map((escola) => <SelectItem key={escola.id} value={escola.id}>{escola.name} · INEP {escola.inep}</SelectItem>)}</SelectContent>
                </Select>
                <StatusFilterSelect value={statusEscola} onChange={setStatusEscola} />
              </div>
              <Summary registros={registros.filter((row) => row.escola_id === selectedEscola)} />
              <RecordsTable registros={escolaRows} groupColumn="simulado" />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ id: string; label: string; total: number; avaliadas: number; pendentes: number; percentual: number }> }) {
  return (
    <div className="rounded-md border p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-4 max-h-80 space-y-4 overflow-auto pr-1">
        {rows.map((row) => (
          <div key={row.id}>
            <div className="mb-1 flex items-start justify-between gap-3 text-sm">
              <span className="font-medium">{row.label}</span>
              <span className="shrink-0 text-muted-foreground">{row.avaliadas}/{row.total} · {row.percentual}%</span>
            </div>
            <Progress value={row.percentual} />
            {row.pendentes > 0 && <p className="mt-1 text-xs text-destructive">{row.pendentes} pendente(s)</p>}
          </div>
        ))}
      </div>
    </div>
  );
}