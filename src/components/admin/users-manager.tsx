import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, UserCog, KeyRound } from "lucide-react";
import { toast } from "sonner";

import {
  listManagedUsers,
  createManagedUser,
  updateManagedUser,
  deleteManagedUser,
} from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
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
import { Badge } from "@/components/ui/badge";

type School = { id: string; name: string; inep: string };

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  superintendente: "Superintendente Escolar",
  professor_responsavel: "Professor responsável",
  gestor: "Gestor escolar",
  professor_escola: "Professor da escola",
  professor: "Professor",
  aluno: "Aluno",
};

const ROLE_OPTIONS = [
  "professor_responsavel",
  "gestor",
  "professor_escola",
  "superintendente",
  "admin",
] as const;

const CARGOS = ["Diretor(a)", "Coordenador(a)"] as const;
const TURNOS = ["Manhã", "Tarde", "Noite", "Integral"] as const;
const SCHOOL_BOUND_ROLES = new Set([
  "professor_responsavel",
  "gestor",
  "professor_escola",
  "professor",
]);

function genTempPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%&*?";
  const groups = [upper, lower, numbers, symbols];
  const chars = groups.join("");
  const pick = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
  const password = [upper, lower, numbers, symbols].map(pick);
  for (let i = password.length; i < 14; i++) password.push(pick(chars));
  return password.sort(() => Math.random() - 0.5).join("");
}

function isStrongEnoughPassword(password?: string) {
  if (!password || password.length < 10) return false;
  return /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function toastPasswordPolicy() {
  toast.error("Use uma senha mais forte, com pelo menos 10 caracteres, letras maiúsculas, minúsculas, números e símbolos.");
}

export function UsersManager({ schools }: { schools: School[] }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listManagedUsers);
  const createFn = useServerFn(createManagedUser);
  const updateFn = useServerFn(updateManagedUser);
  const delFn = useServerFn(deleteManagedUser);

  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [newPw, setNewPw] = useState("");

  const usersQ = useQuery({ queryKey: ["managed-users"], queryFn: () => listFn() });

  const create = useMutation({
    mutationFn: (payload: any) => createFn({ data: payload }),
    onSuccess: (result: any) => {
      if (result?.ok === false) {
        toast.error(result.error ?? "Senha recusada pelo sistema.");
        return;
      }
      toast.success("Usuário criado.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["managed-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const update = useMutation({
    mutationFn: (payload: any) => updateFn({ data: payload }),
    onSuccess: (result: any) => {
      if (result?.ok === false) {
        toast.error(result.error ?? "Senha recusada pelo sistema.");
        return;
      }
      toast.success("Usuário atualizado.");
      setOpen(false);
      setPwOpen(false);
      setNewPw("");
      qc.invalidateQueries({ queryKey: ["managed-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { user_id: id } }),
    onSuccess: () => {
      toast.success("Usuário removido.");
      qc.invalidateQueries({ queryKey: ["managed-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function openNew() {
    setEditing({
      _new: true,
      email: "",
      full_name: "",
      password: genTempPassword(),
      role: "professor_responsavel",
      school_id: "",
      cargo: "",
      disciplinas: "",
      serie: "",
      turno: "",
      turma_ids: [] as string[],
    });
    setOpen(true);
  }

  function openEdit(u: any) {
    setEditing({
      _new: false,
      user_id: u.id,
      full_name: u.full_name ?? "",
      role: u.roles?.[0] ?? "professor_responsavel",
      school_id: u.school_id ?? "",
      email: u.email,
      password: "",
      cargo: u.cargo ?? "",
      disciplinas: (u.disciplinas ?? []).join(", "),
      serie: u.serie ?? "",
      turno: u.turno ?? "",
      turma_ids: u.turma_ids ?? [],
    });
    setOpen(true);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const needsSchool = SCHOOL_BOUND_ROLES.has(editing.role);
    const school_id = needsSchool ? editing.school_id || null : null;
    if (needsSchool && !school_id) {
      toast.error("Selecione a escola.");
      return;
    }
    const disciplinas = editing.disciplinas
      ? String(editing.disciplinas)
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : null;
    const extras = {
      cargo: editing.cargo || null,
      disciplinas,
      serie: editing.serie || null,
      turno: editing.turno || null,
      turma_ids: editing.role === "professor_escola" ? editing.turma_ids ?? [] : null,
    };
    if (editing._new) {
      if (!isStrongEnoughPassword(editing.password)) {
        toastPasswordPolicy();
        return;
      }
      create.mutate({
        email: editing.email.trim(),
        password: editing.password,
        full_name: editing.full_name.trim(),
        role: editing.role,
        school_id,
        ...extras,
      });
    } else {
      if (editing.password && !isStrongEnoughPassword(editing.password)) {
        toastPasswordPolicy();
        return;
      }
      update.mutate({
        user_id: editing.user_id,
        full_name: editing.full_name.trim(),
        role: editing.role,
        school_id,
        new_password: editing.password ? editing.password : null,
        ...extras,
      });
    }
  }

  function changePw() {
    if (!isStrongEnoughPassword(newPw)) {
      toastPasswordPolicy();
      return;
    }
    update.mutate({ user_id: editing.user_id, new_password: newPw });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-5 w-5" /> Usuários do sistema
        </CardTitle>
        <CardDescription>
          Cadastre professores responsáveis e gestores escolares e vincule à escola.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Novo usuário
          </Button>
        </div>

        <div className="overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">E-mail</th>
                <th className="px-3 py-2">Papel</th>
                <th className="px-3 py-2">Escola</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(usersQ.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              )}
              {usersQ.data?.map((u: any) => (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2">{u.full_name ?? "—"}</td>
                  <td className="px-3 py-2">{u.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    {u.roles?.length ? (
                      u.roles.map((r: string) => (
                        <Badge key={r} variant="secondary" className="mr-1">
                          {ROLE_LABELS[r] ?? r}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {u.school_name ? `${u.school_name} (${u.school_inep})` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Redefinir senha"
                      onClick={() => {
                        setEditing({ user_id: u.id, full_name: u.full_name });
                        setNewPw(genTempPassword());
                        setPwOpen(true);
                      }}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Excluir ${u.full_name ?? u.email}?`)) del.mutate(u.id);
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

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing?._new ? "Novo usuário" : "Editar usuário"}</DialogTitle>
            </DialogHeader>
            {editing && (
              <form onSubmit={save} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nome completo</Label>
                  <Input
                    value={editing.full_name}
                    onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={editing.email}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                    required
                    disabled={!editing._new}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>{editing._new ? "Senha de acesso" : "Nova senha (opcional)"}</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing({ ...editing, password: genTempPassword() })}
                    >
                      Gerar
                    </Button>
                  </div>
                  <PasswordInput
                    value={editing.password ?? ""}
                    onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                    required={editing._new}
                    minLength={10}
                    placeholder={editing._new ? "Mínimo 10 caracteres" : "Deixe em branco para manter a atual"}
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    {editing._new
                      ? "Use letras maiúsculas, minúsculas, números e símbolos. Evite senhas comuns."
                      : "Preencha apenas se desejar redefinir a senha; use letras, números e símbolos."}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Papel</Label>
                  <Select
                    value={editing.role}
                    onValueChange={(v) => setEditing({ ...editing, role: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {SCHOOL_BOUND_ROLES.has(editing.role) && (
                  <div className="space-y-1.5">
                    <Label>Escola</Label>
                    <Select
                      value={editing.school_id}
                      onValueChange={(v) => setEditing({ ...editing, school_id: v, turma_ids: [] })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {schools.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.inep})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {editing.role === "gestor" && (
                  <div className="space-y-1.5">
                    <Label>Cargo</Label>
                    <Select
                      value={editing.cargo ?? ""}
                      onValueChange={(v) => setEditing({ ...editing, cargo: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cargo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CARGOS.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {editing.role === "professor_escola" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Série</Label>
                        <Input
                          value={editing.serie ?? ""}
                          onChange={(e) => setEditing({ ...editing, serie: e.target.value })}
                          placeholder="Ex.: 3º ano"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Turno</Label>
                        <Select
                          value={editing.turno ?? ""}
                          onValueChange={(v) => setEditing({ ...editing, turno: v })}
                        >
                          <SelectTrigger><SelectValue placeholder="Turno" /></SelectTrigger>
                          <SelectContent>
                            {TURNOS.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Disciplina(s) de lotação</Label>
                      <Input
                        value={editing.disciplinas ?? ""}
                        onChange={(e) => setEditing({ ...editing, disciplinas: e.target.value })}
                        placeholder="Ex.: Matemática, Física"
                      />
                      <p className="text-xs text-muted-foreground">Separe múltiplas disciplinas por vírgula.</p>
                    </div>
                    <TurmasMultiSelect
                      schoolId={editing.school_id}
                      value={editing.turma_ids ?? []}
                      onChange={(ids) => setEditing({ ...editing, turma_ids: ids })}
                    />
                  </>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={create.isPending || update.isPending}
                >
                  {create.isPending || update.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={pwOpen} onOpenChange={setPwOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Redefinir senha — {editing?.full_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nova senha</Label>
                <PasswordInput value={newPw} onChange={(e) => setNewPw(e.target.value)} minLength={10} />
                <p className="text-xs text-muted-foreground">
                  Use pelo menos 10 caracteres com letras maiúsculas, minúsculas, números e símbolos.
                </p>
              </div>
              <Button onClick={changePw} disabled={update.isPending} className="w-full">
                {update.isPending ? "Atualizando..." : "Atualizar senha"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
