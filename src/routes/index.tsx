import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { validateCode } from "@/lib/prisma.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import logoUrl from "@/assets/prisma-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PRISMA — CREDE 3 | Plataforma Regional de Simulados" },
      {
        name: "description",
        content:
          "PRISMA: Plataforma Regional de Simulados e Monitoramento da Aprendizagem da CREDE 3. Acesse com suas credenciais ou código do aluno.",
      },
      { property: "og:title", content: "PRISMA — CREDE 3" },
      {
        property: "og:description",
        content: "Plataforma Regional de Simulados e Monitoramento da Aprendizagem.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel" });
    });
  }, [navigate]);

  return (
    <div
      className="min-h-screen text-primary-foreground"
      style={{ background: "var(--gradient-brand)" }}
    >

      {/* Banner removed by request */}

      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-2xl flex-col items-center justify-center gap-12 px-6 py-10">
        <header className="flex flex-col items-center text-center">
          {/* Logo temporarily removed due to electoral period */}
          {/* <div className="rounded-3xl bg-white/95 p-6 shadow-2xl ring-1 ring-white/40 backdrop-blur">
            <img
              src={logoUrl}
              alt="Logomarca PRISMA — Plataforma Regional de Simulados e Monitoramento da Aprendizagem"
              className="h-56 w-auto md:h-72"
            />
          </div> */}
          <h1 className="mt-8 text-3xl font-bold tracking-tight md:text-4xl">
            PRISMA — Plataforma Regional de Simulados e Monitoramento da Aprendizagem
          </h1>
          <p className="mt-3 max-w-md text-base text-primary-foreground/80">
            CREDE 3 — acompanhamento de resultados de simulados regionais, com acesso para
            professores e alunos.
          </p>
        </header>

        <Card className="w-full max-w-md border-white/10 bg-white text-foreground shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Acessar a plataforma</CardTitle>
            <CardDescription className="text-center">Entre com suas credenciais.</CardDescription>
          </CardHeader>
          <CardContent>
            <CredentialsForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CredentialsForm() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const email = `${user.trim().toLowerCase()}@prof.ce.gov.br`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user.trim()) return toast.error("Informe o usuário.");
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo(a)!");
        navigate({ to: "/painel" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/painel`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Cadastro criado. Você já pode entrar.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no acesso");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === "signup" && (
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Nome completo</Label>
          <Input
            id="full_name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Maria da Silva"
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="user">Usuário</Label>
        <div className="flex items-stretch overflow-hidden rounded-md border border-input">
          <Input
            id="user"
            value={user}
            onChange={(e) => setUser(e.target.value.replace(/\s/g, ""))}
            placeholder="seu.usuario"
            className="border-0 shadow-none focus-visible:ring-0"
            autoComplete="username"
          />
          <span className="flex items-center bg-muted px-3 text-sm text-muted-foreground">
            @prof.ce.gov.br
          </span>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Senha</Label>
          {mode === "signin" && <ForgotPasswordLink defaultUser={user} />}
        </div>
        <PasswordInput
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
      </Button>
      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {mode === "signin" ? "Não tem conta? Cadastrar-se" : "Já tem conta? Entrar"}
      </button>
    </form>
  );
}

function ForgotPasswordLink({ defaultUser }: { defaultUser: string }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(defaultUser);
  const [loading, setLoading] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const name = user.trim().toLowerCase();
    if (!name) return toast.error("Informe o usuário.");
    setLoading(true);
    try {
      const email = `${name}@prof.ce.gov.br`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Enviamos um link de recuperação para o seu e-mail.");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar e-mail");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setUser(defaultUser);
          setOpen(true);
        }}
        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        Esqueci minha senha
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>
              Informe seu usuário para receber um link de recuperação no e-mail institucional.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={send} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="recover-user">Usuário</Label>
              <div className="flex items-stretch overflow-hidden rounded-md border border-input">
                <Input
                  id="recover-user"
                  value={user}
                  onChange={(e) => setUser(e.target.value.replace(/\s/g, ""))}
                  placeholder="seu.usuario"
                  className="border-0 shadow-none focus-visible:ring-0"
                  autoComplete="username"
                />
                <span className="flex items-center bg-muted px-3 text-sm text-muted-foreground">
                  @prof.ce.gov.br
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CodeForm() {
  const navigate = useNavigate();
  const validate = useServerFn(validateCode);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await validate({ data: { code } });
      sessionStorage.setItem("prisma:student", JSON.stringify(result));
      toast.success(`Bem-vindo(a), ${result.school_name}`);
      navigate({ to: "/aluno" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Código inválido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="code">Código de acesso</Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="23012345-A7K9"
          className="font-mono tracking-wider"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          O código é fornecido pela sua escola e formado pelo INEP + sufixo.
        </p>
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Verificando..." : "Acessar resultados"}
      </Button>
      <Link to="/" className="block text-center text-xs text-muted-foreground hover:underline">
        Voltar
      </Link>
    </form>
  );
}
