import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMyRole,
  listSchools,
  createSchool,
  generateCodes,
  listSchoolCodes,
} from "@/lib/prisma.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import logoUrl from "@/assets/prisma-logo.png";
import { AssessmentsManager } from "@/components/admin/assessments-manager";
import { SupportMaterialsManager } from "@/components/admin/support-materials-manager";
import { QuestoesManager } from "@/components/admin/questoes-manager";

import { ImportarRespostas } from "@/components/admin/importar-respostas";
import { UsersManager } from "@/components/admin/users-manager";
import { TurmasManager } from "@/components/admin/turmas-manager";
import { listAssessments } from "@/lib/assessments.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — PRISMA" }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getRole = useServerFn(getMyRole);
  const listFn = useServerFn(listSchools);
  const createFn = useServerFn(createSchool);
  const genFn = useServerFn(generateCodes);
  const codesFn = useServerFn(listSchoolCodes);

  const roleQ = useQuery({ queryKey: ["my-role"], queryFn: () => getRole({}) });
  const schoolsQ = useQuery({ queryKey: ["schools"], queryFn: () => listFn({}) });
  const listAssessFn = useServerFn(listAssessments);
  const assessmentsQ = useQuery({
    queryKey: ["assessments-all"],
    queryFn: () => listAssessFn({}),
  });

  const [name, setName] = useState("");
  const [inep, setInep] = useState("");
  const [city, setCity] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<string>("");
  const [qty, setQty] = useState(10);

  const create = useMutation({
    mutationFn: () => createFn({ data: { name, inep, city } }),
    onSuccess: () => {
      toast.success("Escola criada.");
      setName(""); setInep(""); setCity("");
      qc.invalidateQueries({ queryKey: ["schools"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const generate = useMutation({
    mutationFn: () => genFn({ data: { schoolId: selectedSchool, quantity: qty } }),
    onSuccess: () => {
      toast.success(`${qty} código(s) gerado(s).`);
      qc.invalidateQueries({ queryKey: ["codes", selectedSchool] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const codesQ = useQuery({
    queryKey: ["codes", selectedSchool],
    queryFn: () => codesFn({ data: { schoolId: selectedSchool } }),
    enabled: !!selectedSchool,
  });

  if (roleQ.isLoading) return <div className="p-10 text-center">Carregando...</div>;
  if (!roleQ.data?.isAdmin) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
        <Button asChild className="mt-4"><Link to="/painel">Voltar ao painel</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="PRISMA" className="h-10 w-auto" />
            <div>
              <p className="text-sm font-semibold">PRISMA · Admin</p>
              <p className="text-xs text-muted-foreground">CREDE 3</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/painel" })}>
            Voltar
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Administração</h1>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Cadastrar escola</CardTitle>
              <CardDescription>Informe o INEP (8 dígitos) e o nome.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
              >
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>INEP</Label>
                    <Input
                      value={inep}
                      onChange={(e) => setInep(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      placeholder="23012345"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Município</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                </div>
                <Button type="submit" disabled={create.isPending} className="w-full">
                  {create.isPending ? "Salvando..." : "Cadastrar escola"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Escolas cadastradas</CardTitle>
              <CardDescription>{schoolsQ.data?.length ?? 0} escola(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-72 space-y-2 overflow-auto text-sm">
                {schoolsQ.data?.length === 0 && (
                  <p className="text-muted-foreground">Nenhuma escola cadastrada ainda.</p>
                )}
                {schoolsQ.data?.map((s) => (
                  <div key={s.id} className="rounded-md border p-3">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      INEP {s.inep}{s.city ? ` · ${s.city}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>


        <UsersManager schools={(schoolsQ.data ?? []) as any} />

        <TurmasManager schools={(schoolsQ.data ?? []) as any} />

        <AssessmentsManager />

        <SupportMaterialsManager />

        <QuestoesManager simulados={(assessmentsQ.data ?? []) as any} />

        <ImportarRespostas
          simulados={(assessmentsQ.data ?? []) as any}
          schools={(schoolsQ.data ?? []) as any}
        />
      </main>
    </div>
  );
}
