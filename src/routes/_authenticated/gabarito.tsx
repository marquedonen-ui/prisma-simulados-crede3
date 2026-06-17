import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/gabarito")({
  head: () => ({ meta: [{ title: "Gabarito e Material de Apoio — PRISMA" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Gabarito e Material de Apoio</h1>
      <p className="mt-2 text-muted-foreground">
        Gabaritos oficiais, matrizes de referência e materiais de apoio. Conteúdo em breve.
      </p>
    </div>
  );
}
