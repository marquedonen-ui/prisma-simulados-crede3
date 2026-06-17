import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — PRISMA" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">
        Relatórios por Acerto e Padrões de Desempenho
      </h1>
      <p className="mt-2 text-muted-foreground">
        Painéis e relatórios de desempenho por escola, turma e descritor. Conteúdo em breve.
      </p>
    </div>
  );
}
