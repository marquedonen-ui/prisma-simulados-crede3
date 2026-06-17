import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ClipboardList } from "lucide-react";
import { listAssessments } from "@/lib/assessments.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/avaliacao-diagnostica/")({
  head: () => ({ meta: [{ title: "Avaliação Diagnóstica — PRISMA" }] }),
  component: Page,
});

function Page() {
  const listFn = useServerFn(listAssessments);
  const q = useQuery({ queryKey: ["assessments"], queryFn: () => listFn() });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <ClipboardList className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Avaliação Diagnóstica</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Oferta</TableHead>
                <TableHead>Componente Curricular</TableHead>
                <TableHead>Série</TableHead>
                <TableHead className="text-right">Acessar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {q.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Nenhuma avaliação cadastrada ainda.
                  </TableCell>
                </TableRow>
              )}
              {q.data?.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.offer}</TableCell>
                  <TableCell>{a.subject}</TableCell>
                  <TableCell>{a.grade}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      to="/avaliacao-diagnostica/$id"
                      params={{ id: a.id }}
                      className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                    >
                      Clique AQUI <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
