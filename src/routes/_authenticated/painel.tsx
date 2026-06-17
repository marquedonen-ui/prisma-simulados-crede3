import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  BookOpen,
  ClipboardList,
  BarChart3,
  FileCheck,
  ArrowRight,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
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

const tools = [
  {
    title: "Tutoriais",
    description: "Materiais e vídeos para usar a plataforma com facilidade.",
    icon: BookOpen,
    url: "/tutoriais",
  },
  {
    title: "Avaliação Diagnóstica",
    description: "Acesse os cadernos de prova e cartões de resposta.",
    icon: ClipboardList,
    url: "/avaliacao-diagnostica",
  },
  {
    title: "Relatórios de Desempenho",
    description: "Acompanhe acertos, descritores e padrões por turma.",
    icon: BarChart3,
    url: "/relatorios",
  },
  {
    title: "Gabarito e Material de Apoio",
    description: "Baixe gabaritos oficiais e materiais complementares.",
    icon: FileCheck,
    url: "/gabarito",
  },
];

const goals = [
  {
    icon: Target,
    title: "Diagnosticar",
    text: "Avaliar a aprendizagem dos estudantes da CREDE 3 com instrumentos padronizados.",
  },
  {
    icon: BarChart3,
    title: "Monitorar",
    text: "Acompanhar acertos e padrões de desempenho por escola, turma e descritor.",
  },
  {
    icon: Users,
    title: "Apoiar",
    text: "Subsidiar professores e gestores com dados para intervenções pedagógicas.",
  },
];

function Painel() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const getRole = useServerFn(getMyRole);
  const bootstrap = useServerFn(bootstrapFirstAdmin);

  const roleQ = useQuery({ queryKey: ["my-role"], queryFn: () => getRole() });
  const promote = useMutation({
    mutationFn: () => bootstrap(),
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

      <main className="mx-auto max-w-6xl space-y-12 px-6 py-12">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-10 md:p-14">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Plataforma Regional de Simulados
          </div>
          <h1 className="mt-5 text-5xl font-extrabold tracking-tight md:text-6xl">
            PRISMA
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            Sistema da CREDE 3 para aplicação, acompanhamento e análise das avaliações
            diagnósticas das escolas da rede.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/avaliacao-diagnostica">
                Acessar avaliações <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/tutoriais">Ver tutoriais</Link>
            </Button>
          </div>
        </section>

        {/* Objetivos */}
        <section>
          <h2 className="mb-6 text-2xl font-bold tracking-tight">Objetivos</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {goals.map((g) => (
              <Card key={g.title}>
                <CardHeader>
                  <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <g.icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{g.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{g.text}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Ferramentas */}
        <section>
          <h2 className="mb-6 text-2xl font-bold tracking-tight">Ferramentas disponíveis</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {tools.map((t) => (
              <Link key={t.url} to={t.url} className="group">
                <Card className="h-full transition hover:border-primary hover:shadow-md">
                  <CardHeader>
                    <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <t.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="flex items-center justify-between">
                      {t.title}
                      <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                    </CardTitle>
                    <CardDescription>{t.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Convite */}
        <section className="rounded-2xl border bg-card p-8 text-center md:p-10">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Comece agora a explorar a plataforma
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            Use o menu lateral para navegar entre as ferramentas, ou acesse diretamente as
            avaliações diagnósticas da sua escola.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/avaliacao-diagnostica">
              Acessar sistema <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </section>

        {/* Bootstrap admin — only visible when there's no admin yet */}
        {!roleQ.isLoading && !roleQ.data?.isAdmin && (
          <section>
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">É o primeiro gestor da CREDE 3?</CardTitle>
                <CardDescription>
                  Ative seu acesso administrativo (disponível apenas até o primeiro admin ser criado).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="secondary"
                  disabled={promote.isPending}
                  onClick={() => promote.mutate()}
                >
                  {promote.isPending ? "Aguarde..." : "Tornar-me administrador"}
                </Button>
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}
