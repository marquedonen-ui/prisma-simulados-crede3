import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  Users,
  FileQuestion,
} from "lucide-react";
import { toast } from "sonner";
import {
  listSimuladosCorrecao,
  corrigirSimulado,
  listResultados,
  toggleGabaritoLiberado,
  getGabarito,
} from "@/lib/correcao.functions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/correcao")({
  head: () => ({ meta: [{ title: "Correção de Simulados — PRISMA" }] }),
  component: CorrecaoPage,
});

type Simulado = Awaited<ReturnType<typeof listSimuladosCorrecao>>[number];
type Resultado = Awaited<ReturnType<typeof listResultados>>[number];

function CorrecaoPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSimuladosCorrecao);
  const corrigirFn = useServerFn(corrigirSimulado);
  const toggleFn = useServerFn(toggleGabaritoLiberado);

  const simuladosQ = useQuery({
    queryKey: ["correcao", "simulados"],
    queryFn: () => listFn(),
  });

  const [openResultados, setOpenResultados] = useState<Simulado | null>(null);
  const [openGabarito, setOpenGabarito] = useState<Simulado | null>(null);

  const corrigir = useMutation({
    mutationFn: (simuladoId: string) => corrigirFn({ data: { simuladoId } }),
    onSuccess: (r) => {
      toast.success(`Correção realizada com sucesso! ${r.corrigidos} aluno(s) corrigido(s).`);
      qc.invalidateQueries({ queryKey: ["correcao"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao corrigir."),
  });

  const toggleGab = useMutation({
    mutationFn: (v: { simuladoId: string; liberado: boolean }) => toggleFn({ data: v }),
    onSuccess: () => {
      toast.success("Visibilidade do gabarito atualizada.");
      qc.invalidateQueries({ queryKey: ["correcao", "simulados"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha."),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Painel do Professor
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          Correção de Simulados
        </h1>
        <p className="mt-1 text-muted-foreground">
          Corrija automaticamente os simulados e acompanhe o desempenho dos alunos.
        </p>
      </header>

      {simuladosQ.isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando simulados...
          </CardContent>
        </Card>
      ) : simuladosQ.data && simuladosQ.data.length > 0 ? (
        <div className="grid gap-4">
          {simuladosQ.data.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">
                      {s.offer} — {s.subject}
                    </CardTitle>
                    <CardDescription>{s.grade}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <FileQuestion className="h-3 w-3" /> {s.total_questoes} questões
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Users className="h-3 w-3" /> {s.alunos_responderam} aluno(s)
                    </Badge>
                    {s.total_corrigidos > 0 && (
                      <Badge className="gap-1 bg-green-600 hover:bg-green-700">
                        <CheckCircle2 className="h-3 w-3" /> {s.total_corrigidos} corrigido(s)
                      </Badge>
                    )}
                    {s.gabarito_liberado && (
                      <Badge variant="outline" className="gap-1">
                        <Eye className="h-3 w-3" /> Gabarito liberado
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  size="lg"
                  onClick={() => corrigir.mutate(s.id)}
                  disabled={corrigir.isPending || s.alunos_responderam === 0}
                >
                  {corrigir.isPending && corrigir.variables === s.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Corrigindo...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Corrigir Automaticamente
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setOpenResultados(s)}
                  disabled={s.total_corrigidos === 0}
                >
                  Ver resultados
                </Button>
                <Button variant="outline" onClick={() => setOpenGabarito(s)}>
                  Visualizar gabarito
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    toggleGab.mutate({ simuladoId: s.id, liberado: !s.gabarito_liberado })
                  }
                  disabled={toggleGab.isPending}
                >
                  {s.gabarito_liberado ? (
                    <>
                      <EyeOff className="mr-2 h-4 w-4" /> Ocultar gabarito dos alunos
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" /> Liberar gabarito aos alunos
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum simulado cadastrado ainda.
          </CardContent>
        </Card>
      )}

      <ResultadosDialog
        simulado={openResultados}
        onClose={() => setOpenResultados(null)}
      />
      <GabaritoDialog simulado={openGabarito} onClose={() => setOpenGabarito(null)} />
    </div>
  );
}

function ResultadosDialog({
  simulado,
  onClose,
}: {
  simulado: Simulado | null;
  onClose: () => void;
}) {
  const listResFn = useServerFn(listResultados);
  const resultadosQ = useQuery({
    queryKey: ["correcao", "resultados", simulado?.id],
    queryFn: () => listResFn({ data: { simuladoId: simulado!.id } }),
    enabled: !!simulado,
  });

  function exportCSV(rows: Resultado[]) {
    const header = ["Nome", "Email", "Acertos", "Pontuação", "Total", "Percentual", "Data"];
    const lines = rows.map((r) =>
      [
        `"${r.nome.replace(/"/g, '""')}"`,
        `"${r.email}"`,
        r.acertos,
        r.pontuacao_obtida,
        r.total_questoes,
        `${r.percentual}%`,
        new Date(r.data_finalizacao).toLocaleString("pt-BR"),
      ].join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resultados-${simulado?.subject ?? "simulado"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={!!simulado} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Ranking — {simulado?.offer} · {simulado?.subject} · {simulado?.grade}
          </DialogTitle>
        </DialogHeader>
        {resultadosQ.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : resultadosQ.data && resultadosQ.data.length > 0 ? (
          <>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => exportCSV(resultadosQ.data)}>
                <Download className="mr-2 h-4 w-4" /> Exportar CSV
              </Button>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Aluno</TableHead>
                    <TableHead className="text-right">Acertos</TableHead>
                    <TableHead className="text-right">Pontuação</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultadosQ.data.map((r, i) => (
                    <TableRow key={r.usuario_id}>
                      <TableCell className="font-medium">{i + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.nome}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.acertos}/{r.total_questoes}
                      </TableCell>
                      <TableCell className="text-right">{r.pontuacao_obtida}</TableCell>
                      <TableCell className="text-right font-semibold">{r.percentual}%</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.data_finalizacao).toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-muted-foreground">
            Nenhum resultado disponível. Execute a correção primeiro.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GabaritoDialog({
  simulado,
  onClose,
}: {
  simulado: Simulado | null;
  onClose: () => void;
}) {
  const getGabFn = useServerFn(getGabarito);
  const gabQ = useQuery({
    queryKey: ["correcao", "gabarito", simulado?.id],
    queryFn: () => getGabFn({ data: { simuladoId: simulado!.id } }),
    enabled: !!simulado,
  });

  return (
    <Dialog open={!!simulado} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Gabarito — {simulado?.offer} · {simulado?.subject}
          </DialogTitle>
        </DialogHeader>
        {gabQ.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : gabQ.data && gabQ.data.length > 0 ? (
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Nº</TableHead>
                  <TableHead>Enunciado</TableHead>
                  <TableHead className="w-24 text-center">Resposta</TableHead>
                  <TableHead className="w-20 text-right">Pontos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gabQ.data.map((q) => (
                  <TableRow key={q.numero}>
                    <TableCell className="font-medium">{q.numero}</TableCell>
                    <TableCell className="text-sm">{q.enunciado}</TableCell>
                    <TableCell className="text-center">
                      <Badge>{q.resposta_correta.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{q.pontos}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="py-6 text-center text-muted-foreground">
            Nenhuma questão cadastrada para este simulado.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
