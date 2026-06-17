import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import logoUrl from "@/assets/prisma-logo.png";

type Session = { code: string; school_name: string; school_inep: string };

export const Route = createFileRoute("/aluno")({
  ssr: false,
  head: () => ({ meta: [{ title: "Aluno — PRISMA" }] }),
  component: AlunoPage,
});

function AlunoPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("prisma:student");
    if (!raw) { navigate({ to: "/" }); return; }
    setSession(JSON.parse(raw));
  }, [navigate]);

  if (!session) return null;

  function exit() {
    sessionStorage.removeItem("prisma:student");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="PRISMA" className="h-10 w-auto" />
            <div>
              <p className="text-sm font-semibold">PRISMA · Aluno</p>
              <p className="text-xs text-muted-foreground">CREDE 3</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exit}>Sair</Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bem-vindo(a)</h1>
          <p className="mt-1 text-muted-foreground">
            Acesso pelo código <span className="font-mono">{session.code}</span>
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sua escola</CardTitle>
            <CardDescription>Dados vinculados ao seu código de acesso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Escola:</span> {session.school_name}</p>
            <p><span className="text-muted-foreground">INEP:</span> {session.school_inep}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seus resultados</CardTitle>
            <CardDescription>Em breve</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Assim que os simulados forem lançados, seus resultados, gabaritos comentados e
            comparativos por turma aparecerão aqui.
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
