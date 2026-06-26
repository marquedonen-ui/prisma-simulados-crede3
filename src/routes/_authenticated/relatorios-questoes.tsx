import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ListChecks, Loader2, ArrowUpDown } from "lucide-react";
import { listSimuladosComRespostas, getRelatorioQuestoes, getResultadosAlunos, getMyReportScope } from "@/lib/relatorios.functions";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/relatorios-questoes")({
  head: () => ({ meta: [{ title: "Relatórios por Questão — PRISMA" }] }),
  component: Page,
});

type Padrao = "muito_critico" | "critico" | "intermediario" | "adequado";

const padraoMeta: Record<Padrao, { label: string; bg: string; text: string }> = {
  muito_critico: { label: "Muito Crítico", bg: "bg-red-500", text: "text-white" },
  critico: { label: "Crítico", bg: "bg-yellow-400", text: "text-black" },
  intermediario: { label: "Intermediário", bg: "bg-green-500", text: "text-white" },
  adequado: { label: "Adequado", bg: "bg-blue-500", text: "text-white" },
};

function Page() {
  const listSimFn = useServerFn(listSimuladosComRespostas);
  const getQFn = useServerFn(getRelatorioQuestoes);
  const getResFn = useServerFn(getResultadosAlunos);
  const getScopeFn = useServerFn(getMyReportScope);
  const scopeQ = useQuery({ queryKey: ["report-scope"], queryFn: () => getScopeFn() });
  const scoped = !!scopeQ.data?.scoped;

  const [simuladoId, setSimuladoId] = useState("");
  const [escolaId, setEscolaId] = useState<string>("__all");
  const [turmaId, setTurmaId] = useState<string>("__all");
  const [disciplina, setDisciplina] = useState<string>("__all");
  const [sortBy, setSortBy] = useState<"numero" | "acertos_desc" | "acertos_asc" | "pct_desc" | "pct_asc">(
    "numero",
  );

  const simQ = useQuery({ queryKey: ["rel-sims"], queryFn: () => listSimFn() });
  const alunosQ = useQuery({
    queryKey: ["rel-questoes-alunos", simuladoId],
    queryFn: () => getResFn({ data: { simuladoId } }),
    enabled: !!simuladoId,
  });
  const dataQ = useQuery({
    queryKey: ["rel-questoes", simuladoId, escolaId, turmaId],
    queryFn: () =>
      getQFn({
        data: {
          simuladoId,
          escolaId: escolaId === "__all" ? null : escolaId,
          turmaId: turmaId === "__all" ? null : turmaId,
        },
      }),
    enabled: !!simuladoId,
  });

  const alunos = alunosQ.data?.alunos ?? [];

  const escolasDisponiveis = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of alunos) m.set(a.school_id ?? "sem", a.school_name);
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [alunos]);

  const turmasDisponiveis = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of alunos) {
      if (escolaId !== "__all" && (a.school_id ?? "sem") !== escolaId) continue;
      m.set(a.turma_id, a.turma_nome);
    }
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [alunos, escolaId]);

  const disciplinas = useMemo(() => {
    const set = new Set<string>();
    (dataQ.data ?? []).forEach((q) => q.disciplina && set.add(q.disciplina));
    return Array.from(set).sort();
  }, [dataQ.data]);


  const linhas = useMemo(() => {
    let arr = [...(dataQ.data ?? [])];
    if (disciplina !== "__all") {
      arr = arr.filter((q) => (q.disciplina ?? "") === disciplina);
    }
    switch (sortBy) {
      case "acertos_desc":
        arr.sort((a, b) => b.acertos - a.acertos);
        break;
      case "acertos_asc":
        arr.sort((a, b) => a.acertos - b.acertos);
        break;
      case "pct_desc":
        arr.sort((a, b) => b.pct_acerto - a.pct_acerto);
        break;
      case "pct_asc":
        arr.sort((a, b) => a.pct_acerto - b.pct_acerto);
        break;
      default:
        arr.sort((a, b) => a.numero - b.numero);
    }
    return arr;
  }, [dataQ.data, disciplina, sortBy]);

  const resumo = useMemo(() => {
    const r = { muito_critico: 0, critico: 0, intermediario: 0, adequado: 0 };
    linhas.forEach((q) => (r[q.padrao] += 1));
    return r;
  }, [linhas]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-10">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-primary">
          <ListChecks className="h-3.5 w-3.5" /> Relatórios por Questão
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Desempenho por questão</h1>
        <p className="text-muted-foreground">
          Acertos, erros e padrão de desempenho de cada questão do simulado.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Selecione o simulado, escola e turma. Filtre opcionalmente por disciplina.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Simulado</Label>
            <Select
              value={simuladoId}
              onValueChange={(v) => {
                setSimuladoId(v);
                setEscolaId("__all");
                setTurmaId("__all");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={simQ.isLoading ? "Carregando..." : "Selecione"} />
              </SelectTrigger>
              <SelectContent>
                {(simQ.data ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.offer ?? "Oferta"} · {s.subject ?? ""} · {s.grade ?? ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Escola</Label>
            <Select
              value={escolaId}
              onValueChange={(v) => {
                setEscolaId(v);
                setTurmaId("__all");
              }}
              disabled={!simuladoId || escolasDisponiveis.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas as escolas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas as escolas</SelectItem>
                {escolasDisponiveis.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Turma</Label>
            <Select
              value={turmaId}
              onValueChange={setTurmaId}
              disabled={!simuladoId || turmasDisponiveis.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas as turmas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas as turmas</SelectItem>
                {turmasDisponiveis.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Disciplina</Label>
            <Select value={disciplina} onValueChange={setDisciplina} disabled={!simuladoId}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas as disciplinas</SelectItem>
                {disciplinas.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Ordenar por</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)} disabled={!simuladoId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="numero">Nº da questão</SelectItem>
                <SelectItem value="pct_desc">Maior % de acerto</SelectItem>
                <SelectItem value="pct_asc">Menor % de acerto</SelectItem>

              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!simuladoId && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Selecione um simulado para visualizar o relatório.
          </CardContent>
        </Card>
      )}

      {simuladoId && dataQ.isLoading && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
        </div>
      )}

      {simuladoId && dataQ.data && (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            {(Object.keys(padraoMeta) as Padrao[]).map((p) => (
              <Card key={p}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">{padraoMeta[p].label}</p>
                    <p className="text-2xl font-bold">{resumo[p]}</p>
                    <p className="text-xs text-muted-foreground">questões</p>
                  </div>
                  <span className={`h-10 w-10 rounded-full ${padraoMeta[p].bg}`} />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Questões ({linhas.length})</CardTitle>
              <CardDescription>
                Padrão: Muito Crítico ≤ 25% · Crítico ≤ 50% · Intermediário ≤ 75% · Adequado &gt; 75%
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">
                      <button
                        className="inline-flex items-center gap-1"
                        onClick={() => setSortBy("numero")}
                      >
                        Nº <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>Disciplina</TableHead>
                    <TableHead>
                      <button
                        className="inline-flex items-center gap-1"
                        onClick={() =>
                          setSortBy(sortBy === "acertos_desc" ? "acertos_asc" : "acertos_desc")
                        }
                      >
                        Acertos <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>Erros</TableHead>
                    <TableHead>Em branco</TableHead>
                    <TableHead>
                      <button
                        className="inline-flex items-center gap-1"
                        onClick={() =>
                          setSortBy(sortBy === "pct_desc" ? "pct_asc" : "pct_desc")
                        }
                      >
                        % Acerto <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>Padrão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((q) => {
                    const meta = padraoMeta[q.padrao];
                    return (
                      <TableRow key={q.questao_id}>
                        <TableCell className="font-medium">
                          {q.numero}
                          {q.anulada && (
                            <Badge variant="outline" className="ml-1 text-[10px]">
                              Anulada
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{q.disciplina ?? "—"}</TableCell>
                        <TableCell>{q.acertos}</TableCell>
                        <TableCell>{q.erros}</TableCell>
                        <TableCell>{q.brancos}</TableCell>
                        <TableCell>{q.pct_acerto}%</TableCell>
                        <TableCell>
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${meta.bg} ${meta.text}`}
                          >
                            {meta.label}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {linhas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Sem questões para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
