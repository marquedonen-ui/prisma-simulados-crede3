import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Users } from "lucide-react";
import { toast } from "sonner";

import { listAlunos, upsertAluno, deleteAluno } from "@/lib/offline.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type School = { id: string; name: string; inep: string };

export function AlunosManager({ schools }: { schools: School[] }) {
  const qc = useQueryClient();
  const [schoolId, setSchoolId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const listFn = useServerFn(listAlunos);
  const upsertFn = useServerFn(upsertAluno);
  const delFn = useServerFn(deleteAluno);

  const alunosQ = useQuery({
    queryKey: ["alunos", schoolId],
    queryFn: () => listFn({ data: { schoolId } }),
    enabled: !!schoolId,
  });

  const upsert = useMutation({
    mutationFn: (payload: any) => upsertFn({ data: payload }),
    onSuccess: () => {
      toast.success("Aluno salvo.");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["alunos", schoolId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Aluno removido.");
      qc.invalidateQueries({ queryKey: ["alunos", schoolId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function openNew() {
    setEditing({ matricula: "", nome: "", turma: "", ativo: true, school_id: schoolId });
    setOpen(true);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    upsert.mutate({ ...editing, school_id: schoolId });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Alunos por escola (matrícula)
        </CardTitle>
        <CardDescription>
          Cadastre os alunos pela matrícula — usada para importar as respostas das provas
          impressas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Select value={schoolId} onValueChange={setSchoolId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma escola..." />
            </SelectTrigger>
            <SelectContent>
              {schools.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.inep})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openNew} disabled={!schoolId}>
            <Plus className="mr-2 h-4 w-4" /> Novo aluno
          </Button>
        </div>

        {schoolId && (
          <div className="max-h-96 overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Matrícula</th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Turma</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(alunosQ.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      Nenhum aluno cadastrado.
                    </td>
                  </tr>
                )}
                {alunosQ.data?.map((a: any) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2 font-mono">{a.matricula}</td>
                    <td className="px-3 py-2">{a.nome}</td>
                    <td className="px-3 py-2">{a.turma ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remover ${a.nome}?`)) del.mutate(a.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Editar aluno" : "Novo aluno"}</DialogTitle>
            </DialogHeader>
            {editing && (
              <form onSubmit={save} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Matrícula</Label>
                  <Input
                    value={editing.matricula}
                    onChange={(e) => setEditing({ ...editing, matricula: e.target.value })}
                    required
                    maxLength={50}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome completo</Label>
                  <Input
                    value={editing.nome}
                    onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                    required
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Turma</Label>
                  <Input
                    value={editing.turma ?? ""}
                    onChange={(e) => setEditing({ ...editing, turma: e.target.value })}
                    placeholder="9º A"
                    maxLength={50}
                  />
                </div>
                <Button type="submit" disabled={upsert.isPending} className="w-full">
                  {upsert.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
