import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BookCheck, Download, FileSearch, ExternalLink } from "lucide-react";
import {
  listSupportMaterials,
  getSupportFileUrl,
} from "@/lib/support-materials.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/gabarito")({
  head: () => ({ meta: [{ title: "Gabarito e Material de Apoio — PRISMA" }] }),
  component: Page,
});

function Page() {
  const listFn = useServerFn(listSupportMaterials);
  const urlFn = useServerFn(getSupportFileUrl);
  const q = useQuery({ queryKey: ["support-materials"], queryFn: () => listFn() });

  const download = useMutation({
    mutationFn: (path: string) => urlFn({ data: { path } }),
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao gerar link"),
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BookCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gabarito e Material de Apoio</h1>
          <p className="text-sm text-muted-foreground">
            Gabaritos, testes comentados e materiais de apoio. O cadastro é feito pelo
            administrador no menu <strong>Administração</strong>.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Oferta</TableHead>
              <TableHead>Série</TableHead>
              <TableHead>Componente</TableHead>
              <TableHead>Gabarito</TableHead>
              <TableHead>Teste comentado</TableHead>
              <TableHead>Material de Apoio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!q.isLoading && (q.data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum material cadastrado.
                </TableCell>
              </TableRow>
            )}
            {q.data?.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.offer}</TableCell>
                <TableCell>{a.grade}</TableCell>
                <TableCell>
                  {a.answer_key_pdf_path ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-primary hover:text-primary"
                      disabled={download.isPending}
                      onClick={() => download.mutate(a.answer_key_pdf_path!)}
                    >
                      <Download className="mr-1.5 h-4 w-4" /> Baixar
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {a.commented_test_pdf_path ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-primary hover:text-primary"
                      disabled={download.isPending}
                      onClick={() => download.mutate(a.commented_test_pdf_path!)}
                    >
                      <FileSearch className="mr-1.5 h-4 w-4" /> Baixar
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {a.support_material_url ? (
                    <a
                      href={a.support_material_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      Acessar <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
