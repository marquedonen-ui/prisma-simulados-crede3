import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole, bootstrapFirstAdmin } from "@/lib/prisma.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import logoUrl from "@/assets/ceara-logo.png";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [{ title: "Painel — PRISMA" }] }),
  component: Painel,
});

function Painel() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const getRole = useServerFn(getMyRole);
  const bootstrap = useServerFn(bootstrapFirstAdmin);

  const roleQ = useQuery({ queryKey: ["my-role"], queryFn: () => getRole({}) });
  const promote = useMutation({
    mutationFn: () => bootstrap({}),
    onSuccess: () => {
      toast.success("Você agora é administrador.");
      roleQ.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Governo do Ceará" className="h-12 w-auto" />
            <div>
              <p className="text-sm font-semibold">PRISMA</p>
              <p className="text-xs text-muted-foreground">CREDE 3</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bem-vindo(a)</h1>
          <p className="mt-1 text-muted-foreground">
            Esta é sua área da Plataforma Regional de Simulados.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Seu perfil</CardTitle>
              <CardDescription>Informações de acesso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">E-mail:</span> {user.email}
              </p>
              <p>
                <span className="text-muted-foreground">Perfis:</span>{" "}
                {roleQ.isLoading
                  ? "Carregando..."
                  : (roleQ.data?.roles.join(", ") || "professor")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Administração</CardTitle>
              <CardDescription>Gestão de escolas e códigos de alunos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {roleQ.data?.isAdmin ? (
                <Button asChild className="w-full">
                  <Link to="/admin">Abrir painel admin</Link>
                </Button>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Você ainda não tem perfil de administrador. Se você é o primeiro gestor da
                    CREDE 3, ative o acesso administrativo abaixo (disponível apenas até o
                    primeiro admin ser criado).
                  </p>
                  <Button
                    variant="secondary"
                    className="w-full"
                    disabled={promote.isPending}
                    onClick={() => promote.mutate()}
                  >
                    {promote.isPending ? "Aguarde..." : "Tornar-me administrador"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Próximas etapas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>• Cadastro de simulados e gabaritos</p>
            <p>• Lançamento de resultados por turma</p>
            <p>• Painéis de monitoramento por escola e CREDE</p>
            <p>• Visualização individual do aluno via código</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
