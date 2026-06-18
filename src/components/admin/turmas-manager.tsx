import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, GraduationCap } from "lucide-react";
import { toast } from "sonner";

import { listTurmas, upsertTurma, deleteTurma } from "@/lib/turmas.functions";
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

const TURNOS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
  { value: "integral", label: "Integral" },
] as const;

const turnoLabel = (t: string) => TURNOS.find((x) => x.value === t)?.label ?? t;

export function TurmasManager({
  schools,
  defaultSchoolId,
  lockSchool = false,
}: {
  schools: School[];
  defaultSchoolId?: string;
  lockSchool?: boolean;
}) {
  const qc = useQueryClient();
  const [schoolId, setSchoolId] = useState<string>(defaultSchoolId ?? "");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const listFn = useServerFn(listTurmas);
  const upFn = useServerFn(upsertTurma);
  const delFn = useServerFn(deleteTurma);

  const turmasQ = useQuery({
    queryKey: ["turmas", schoolId],
    queryFn: () => listFn({ data: { schoolId } }),
    enabled: !!schoolId,
  });

  const upsert = useMutation({
    mutationFn: (p: any) => upFn({ data: p }),
    onSuccess: () => {
      toast.success("Turma salva.");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["turmas", schoolId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Turma removida.");
      qc.invalidateQueries({ queryKey: ["turmas", schoolId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function openNew() {
    setEditing({ nome: "", ano: String(new Date().getFullYear()), turno: "manha", matricula_sige: "", matricula_atual: "" });
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
          <GraduationCap className="h-5 w-5" /> Turmas
        </CardTitle>
        <CardDescription>
          Nome + ano + turno. Vincule alunos às turmas para relatórios mais ricos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Select value={schoolId} onValueChange={setSchoolId} disabled={lockSchool}>
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
            <Plus className="mr-2 h-4 w-4" /> Nova turma
          </Button>
        </div>

        {schoolId && (
          <div className="overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Turma</th>
                  <th className="px-3 py-2">Ano</th>
                  <th className="px-3 py-2">Turno</th>
                  <th className="px-3 py-2">Matrícula atual</th>
                  <th className="px-3 py-2">SIGE</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>

              </thead>
              <tbody>
                {(turmasQ.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      Nenhuma turma.
                    </td>
                  </tr>
                )}
                {turmasQ.data?.map((t: any) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{t.nome}</td>
                    <td className="px-3 py-2">{t.ano}</td>
                    <td className="px-3 py-2">{turnoLabel(t.turno)}</td>
                    <td className="px-3 py-2">{t.matricula_atual ?? "—"}</td>
                    <td className="px-3 py-2">{t.matricula_sige ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(t);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remover turma ${t.nome}?`)) del.mutate(t.id);
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
              <DialogTitle>{editing?.id ? "Editar turma" : "Nova turma"}</DialogTitle>
            </DialogHeader>
            {editing && (
              <form onSubmit={save} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input
                    value={editing.nome}
                    onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                    placeholder="9º A"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Ano</Label>
                    <Input
                      value={editing.ano}
                      onChange={(e) => setEditing({ ...editing, ano: e.target.value })}
                      placeholder="2026"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Turno</Label>
                    <Select
                      value={editing.turno}
                      onValueChange={(v) => setEditing({ ...editing, turno: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TURNOS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Matrícula atual</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editing.matricula_atual ?? ""}
                      onChange={(e) => setEditing({ ...editing, matricula_atual: e.target.value })}
                      placeholder="Ex.: 32"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Matrícula SIGE</Label>
                    <Input
                      value={editing.matricula_sige ?? ""}
                      onChange={(e) => setEditing({ ...editing, matricula_sige: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
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
