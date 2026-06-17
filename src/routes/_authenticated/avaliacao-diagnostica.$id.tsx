import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, FileText, ListChecks, Download } from "lucide-react";
import { getAssessment, getAssessmentFileUrl } from "@/lib/assessments.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/avaliacao-diagnostica/$id")({
  head: () => ({ meta: [{ title: "Avaliação Diagnóstica — PRISMA" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getAssessment);
  const urlFn = useServerFn(getAssessmentFileUrl);
  const q = useQuery({ queryKey: ["assessment", id], queryFn: () => getFn({ data: { id } }) });

  const download = useMutation({
    mutationFn: (path: string) => urlFn({ data: { path } }),
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao gerar link"),
  });

  if (q.isLoading) return <div className="p-10 text-center">Carregando...</div>;
  if (q.error || !q.data)
    return <div className="p-10 text-center text-destructive">Avaliação não encontrada.</div>;

  const title = `${q.data.offer} - ${q.data.subject} - ${q.data.grade}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link
        to="/avaliacao-diagnostica"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="mb-8 text-3xl font-bold tracking-tight">{title}</h1>

      <div className="grid gap-5 sm:grid-cols-2">
        <Card className="group transition hover:shadow-md">
          <CardHeader>
            <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-6 w-6" />
            </div>
            <CardTitle>Caderno de Provas</CardTitle>
            <CardDescription>Arquivo PDF da avaliação aplicada aos estudantes.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              disabled={!q.data.exam_pdf_path || download.isPending}
              onClick={() => q.data.exam_pdf_path && download.mutate(q.data.exam_pdf_path)}
            >
              <Download className="mr-2 h-4 w-4" />
              {q.data.exam_pdf_path ? "Baixar Caderno de Provas" : "Indisponível"}
            </Button>
          </CardContent>
        </Card>

        <Card className="group transition hover:shadow-md">
          <CardHeader>
            <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ListChecks className="h-6 w-6" />
            </div>
            <CardTitle>Cartões de Resposta</CardTitle>
            <CardDescription>Arquivo PDF dos cartões para preenchimento.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              disabled={!q.data.answer_sheet_pdf_path || download.isPending}
              onClick={() =>
                q.data.answer_sheet_pdf_path && download.mutate(q.data.answer_sheet_pdf_path)
              }
            >
              <Download className="mr-2 h-4 w-4" />
              {q.data.answer_sheet_pdf_path ? "Baixar Cartões de Resposta" : "Indisponível"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
