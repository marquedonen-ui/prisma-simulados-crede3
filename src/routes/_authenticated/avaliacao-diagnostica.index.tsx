import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ExternalLink } from "lucide-react";
import { listAssessments } from "@/lib/assessments.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/avaliacao-diagnostica/")({
  head: () => ({ meta: [{ title: "Avaliação Diagnóstica — PRISMA" }] }),
  component: Page,
});

function Page() {
  const list = useServerFn(listAssessments);
  const q = useQuery({ queryKey: ["assessments"], queryFn: () => list() });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ClipboardList className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Avaliação Diagnóstica</h1>
          <p className="text-sm text-muted-foreground">
            Lista de avaliações disponíveis. O cadastro é feito pelo administrador no menu{" "}
            <strong>Administração</strong>.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Oferta</TableHead>
              <TableHead>Componente Curricular/Disciplina</TableHead>
              <TableHead>Série</TableHead>
              <TableHead className="text-right">Acessar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!q.isLoading && (q.data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhuma avaliação cadastrada.
                </TableCell>
              </TableRow>
            )}
            {q.data?.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.offer}</TableCell>
                <TableCell>{a.subject}</TableCell>
                <TableCell>{a.grade}</TableCell>
                <TableCell className="text-right">
                  <Link
                    to="/avaliacao-diagnostica/$id"
                    params={{ id: a.id }}
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    Clique AQUI <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
