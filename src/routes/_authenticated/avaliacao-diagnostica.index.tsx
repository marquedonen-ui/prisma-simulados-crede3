import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/avaliacao-diagnostica/")({
  head: () => ({ meta: [{ title: "Avaliação Diagnóstica — PRISMA" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-center">
      <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <ClipboardList className="h-7 w-7" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Avaliação Diagnóstica</h1>
      <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
        Esta área está sendo preparada. O cadastro e a gestão das avaliações foram movidos
        para o menu <strong>Administração</strong>.
      </p>
      <Button asChild className="mt-6">
        <Link to="/painel">
          Voltar à página inicial <ArrowRight className="ml-1.5 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
