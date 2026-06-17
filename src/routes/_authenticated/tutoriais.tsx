import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/tutoriais")({
  head: () => ({ meta: [{ title: "Tutoriais — PRISMA" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Tutoriais</h1>
      <p className="mt-2 text-muted-foreground">
        Vídeos e guias de uso da plataforma. Conteúdo em breve.
      </p>
    </div>
  );
}
