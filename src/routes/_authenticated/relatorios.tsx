import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BarChart3, Loader2, Download } from "lucide-react";
import {
  listSimuladosComRespostas,
  getRelatorioSimulado,
} from "@/lib/relatorios.functions";
import { listSchools } from "@/lib/prisma.functions";
import { listTurmas } from "@/lib/turmas.functions";
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

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — PRISMA" }] }),
  component: Page,
});

function Page() {
  const listSimFn = useServerFn(listSimuladosComRespostas);
  const listSchoolsFn = useServerFn(listSchools);
  const listTurmasFn = useServerFn(listTurmas);
  const getRelFn = useServerFn(getRelatorioSimulado);

  const [simuladoId, setSimuladoId] = useState("");
  const [schoolId, setSchoolId] = useState("__all__");
  const [turmaId, setTurmaId] = useState("__all__");

  const simQ = useQuery({ queryKey: ["rel-sims"], queryFn: () => listSimFn() });
  const schoolsQ = useQuery({ queryKey: ["schools"], queryFn: () => listSchoolsFn({}) });
  const turmasQ = useQuery({
    queryKey: ["turmas", schoolId],
    queryFn: () =>
      listTurmasFn({ data: schoolId !== "__all__" ? { schoolId } : {} }),
    enabled: schoolId !== "__all__",
  });

  const relQ = useQuery({
    queryKey: ["relatorio", simuladoId, schoolId, turmaId],
    queryFn: () =>
      getRelFn({
        data: {
          simuladoId,
          schoolId: schoolId !== "__all__" ? schoolId : undefined,
          turmaId: turmaId !== "__all__" ? turmaId : undefined,
        },
      }),
    enabled: !!simuladoId,
  });

  function exportCsv() {
    if (!relQ.data) return;
    const header = ["#", "Matrícula", "Aluno", "Turma", "Escola", "Acertos", "Erros", "Em branco", "%"];
    const rows = relQ.data.alunos.map((a, i) =>
      [
        i + 1,
        `"${a.matricula}"`,
        `"${a.nome.replace(/"/g, '""')}"`,
        `"${a.turma ?? ""}"`,
        `"${a.escola ?? ""}"`,
        a.acertos,
        a.erros,
        a.em_branco,
        `${a.percentual}%`,
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${simuladoId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-primary">
          <BarChart3 className="h-3.5 w-3.5" /> Relatórios
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          Relatórios por Acerto e Padrões de Desempenho
        </h1>
        <p className="mt-1 text-muted-foreground">
          As respostas importadas das planilhas ficam disponíveis aqui. Selecione um simulado para
          ver os resultados por aluno, por questão e por faixa de desempenho.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
          <CardDescription>Escolha o simulado importado e, opcionalmente, escola/turma.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Simulado</Label>
            <Select value={simuladoId} onValueChange={setSimuladoId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {(simQ.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.offer} · {s.subject} · {s.grade} ({s.alunos_distintos} aluno(s))
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Escola</Label>
            <Select value={schoolId} onValueChange={(v) => { setSchoolId(v); setTurmaId("__all__"); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {(schoolsQ.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Turma</Label>
            <Select value={turmaId} onValueChange={setTurmaId} disabled={schoolId === "__all__"}>
              <SelectTrigger><SelectValue placeholder={schoolId === "__all__" ? "Selecione a escola" : "Todas"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {(turmasQ.data ?? []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome} · {t.ano} · {t.turno}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!simuladoId && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          {(simQ.data?.length ?? 0) === 0
            ? "Nenhum simulado com respostas importadas ainda. Importe um cartão-resposta em Administração."
            : "Selecione um simulado acima para ver os relatórios."}
        </CardContent></Card>
      )}

      {simuladoId && relQ.isLoading && (
        <Card><CardContent className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando relatório...
        </CardContent></Card>
      )}

      {relQ.data && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label="Alunos" value={relQ.data.total_alunos} />
            <StatCard label="Questões" value={relQ.data.total_questoes} />
            <StatCard label="Média de acertos" value={relQ.data.media_acertos} />
            <StatCard label="Média %" value={`${relQ.data.media_percentual}%`} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Padrões de desempenho</CardTitle>
              <CardDescription>Faixas por percentual de acerto.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-4">
              <FaixaCard cor="bg-red-500/15 text-red-700 dark:text-red-400" label="Abaixo (<25%)" value={relQ.data.faixas.abaixo} />
              <FaixaCard cor="bg-orange-500/15 text-orange-700 dark:text-orange-400" label="Básico (25–49%)" value={relQ.data.faixas.basico} />
              <FaixaCard cor="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" label="Adequado (50–74%)" value={relQ.data.faixas.adequado} />
              <FaixaCard cor="bg-green-500/15 text-green-700 dark:text-green-400" label="Avançado (≥75%)" value={relQ.data.faixas.avancado} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Desempenho por aluno</CardTitle>
                <CardDescription>Ranking ordenado por acertos.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" /> Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="max-h-[480px] overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Matrícula</th>
                      <th className="px-3 py-2">Aluno</th>
                      <th className="px-3 py-2">Turma</th>
                      <th className="px-3 py-2 text-center">Acertos</th>
                      <th className="px-3 py-2 text-center">Erros</th>
                      <th className="px-3 py-2 text-center">Em branco</th>
                      <th className="px-3 py-2 text-center">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relQ.data.alunos.map((a, i) => (
                      <tr key={a.aluno_id} className="border-t">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 font-mono text-xs">{a.matricula}</td>
                        <td className="px-3 py-2">{a.nome}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{a.turma ?? "—"}</td>
                        <td className="px-3 py-2 text-center font-semibold text-green-600">{a.acertos}</td>
                        <td className="px-3 py-2 text-center text-destructive">{a.erros}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{a.em_branco}</td>
                        <td className="px-3 py-2 text-center font-medium">{a.percentual}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Desempenho por questão</CardTitle>
              <CardDescription>% de acerto e distribuição das alternativas marcadas.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[480px] overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Q</th>
                      <th className="px-3 py-2 text-center">Gabarito</th>
                      <th className="px-3 py-2 text-center">% acerto</th>
                      <th className="px-3 py-2 text-center">A</th>
                      <th className="px-3 py-2 text-center">B</th>
                      <th className="px-3 py-2 text-center">C</th>
                      <th className="px-3 py-2 text-center">D</th>
                      <th className="px-3 py-2 text-center">E</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relQ.data.questoes.map((q) => (
                      <tr key={q.numero} className="border-t">
                        <td className="px-3 py-2 font-medium">{q.numero}</td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant="outline">{q.resposta_correta}</Badge>
                        </td>
                        <td className="px-3 py-2 text-center font-semibold">{q.pct_acerto}%</td>
                        {(["A", "B", "C", "D", "E"] as const).map((alt) => (
                          <td
                            key={alt}
                            className={`px-3 py-2 text-center ${alt === q.resposta_correta ? "font-semibold text-green-600" : "text-muted-foreground"}`}
                          >
                            {q.distribuicao[alt]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function FaixaCard({ cor, label, value }: { cor: string; label: string; value: number }) {
  return (
    <div className={`rounded-md p-3 ${cor}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
