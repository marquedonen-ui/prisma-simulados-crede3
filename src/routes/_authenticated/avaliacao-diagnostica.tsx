import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/avaliacao-diagnostica")({
  head: () => ({ meta: [{ title: "Avaliação Diagnóstica — PRISMA" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Avaliação Diagnóstica</h1>
      <p className="mt-2 text-muted-foreground">
        Aplicação e acompanhamento das avaliações diagnósticas. Conteúdo em breve.
      </p>
    </div>
  );
}
