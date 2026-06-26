import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { getMyProfile, listSchools } from "@/lib/prisma.functions";
import { listAssessments } from "@/lib/assessments.functions";
import { Button } from "@/components/ui/button";
import { ImportarRespostas } from "@/components/admin/importar-respostas";
import { ImportacoesManager } from "@/components/admin/importacoes-manager";
import logoUrl from "@/assets/prisma-logo.png";

export const Route = createFileRoute("/_authenticated/admin/escola")({
  head: () => ({ meta: [{ title: "Administração da Escola — PRISMA" }] }),
  component: AdminEscolaPage,
});

function AdminEscolaPage() {
  const navigate = useNavigate();
  const profileFn = useServerFn(getMyProfile);
  const schoolsFn = useServerFn(listSchools);
  const assessFn = useServerFn(listAssessments);

  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn({}) });
  const schoolsQ = useQuery({ queryKey: ["schools"], queryFn: () => schoolsFn({}) });
  const assessmentsQ = useQuery({
    queryKey: ["assessments-all"],
    queryFn: () => assessFn({}),
  });

  if (profileQ.isLoading) {
    return <div className="p-10 text-center">Carregando...</div>;
  }

  const roles = profileQ.data?.roles ?? [];
  const isAdmin = roles.includes("admin");
  const isProfResp = roles.includes("professor_responsavel");

  if (!isAdmin && !isProfResp) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="text-muted-foreground">
          Acesso restrito a professores responsáveis pela escola.
        </p>
        <Button asChild className="mt-4">
          <Link to="/painel">Voltar ao painel</Link>
        </Button>
      </div>
    );
  }

  const schoolId = profileQ.data?.schoolId ?? null;
  const schoolsForImport = (schoolsQ.data ?? []) as any[];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="PRISMA" className="h-10 w-auto" />
            <div>
              <p className="text-sm font-semibold">PRISMA · Administração da Escola</p>
              <p className="text-xs text-muted-foreground">
                {profileQ.data?.schoolName ?? "Sua escola"}
                {profileQ.data?.schoolInep ? ` · INEP ${profileQ.data.schoolInep}` : ""}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/painel" })}>
            Voltar
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Administração / Escola</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Importe os cartões-resposta (offline) da sua escola, edite respostas dos alunos e
            encerre as avaliações por turma. Após o fechamento, nenhum dado poderá mais ser
            alterado — apenas o administrador geral poderá reabrir.
          </p>
        </div>

        <ImportarRespostas
          simulados={(assessmentsQ.data ?? []) as any}
          schools={schoolsForImport}
          fixedSchoolId={isAdmin ? undefined : (schoolId ?? undefined)}
        />

        <ImportacoesManager isAdmin={isAdmin} />
      </main>
    </div>
  );
}
