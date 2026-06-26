import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { getMyRole } from "@/lib/prisma.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cronograma")({
  head: () => ({ meta: [{ title: "Cronograma — PRISMA" }] }),
  component: CronogramaPage,
});

type Item = {
  id: string;
  data_inicio: string;
  data_fim: string;
  periodo_label: string;
  acao: string;
  responsaveis: string;
  ordem: number;
};

type Status = "Pendente" | "Em Processo" | "Realizada";

function parseDateOnly(value: string): number | null {
  if (!value) return null;
  const text = String(value).trim().slice(0, 10);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  const parsed = new Date(time);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return time;
}

function computeStatus(inicio: string, fim: string): Status {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const ini = parseDateOnly(inicio);
  const end = parseDateOnly(fim);

  if (!ini || !end) return "Pendente";
  if (today < ini) return "Pendente";
  if (today > end) return "Realizada";
  return "Em Processo";
}

function StatusBadge({ status }: { status: Status }) {
  const cls =
    status === "Pendente"
      ? "bg-red-100 text-red-800 border-red-300"
      : status === "Em Processo"
        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
        : "bg-green-100 text-green-800 border-green-300";
  return <Badge variant="outline" className={cls}>{status}</Badge>;
}

async function listCronograma(): Promise<Item[]> {
  const { data, error } = await supabase
    .from("cronograma")
    .select("*")
    .order("ordem", { ascending: true })
    .order("data_inicio", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Item[];
}

function CronogramaPage() {
  const qc = useQueryClient();
  const getRole = useServerFn(getMyRole);
  const roleQ = useQuery({ queryKey: ["my-role"], queryFn: () => getRole({}) });
  const isAdmin = !!roleQ.data?.isAdmin;

  const itemsQ = useQuery({ queryKey: ["cronograma"], queryFn: listCronograma });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({
    periodo_label: "",
    data_inicio: "",
    data_fim: "",
    acao: "",
    responsaveis: "",
    ordem: 0,
  });

  function openNew() {
    setEditing(null);
    setForm({ periodo_label: "", data_inicio: "", data_fim: "", acao: "", responsaveis: "", ordem: (itemsQ.data?.length ?? 0) + 1 });
    setOpen(true);
  }
  function openEdit(it: Item) {
    setEditing(it);
    setForm({
      periodo_label: it.periodo_label,
      data_inicio: it.data_inicio,
      data_fim: it.data_fim,
      acao: it.acao,
      responsaveis: it.responsaveis,
      ordem: it.ordem,
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("cronograma").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cronograma").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Registro atualizado." : "Registro adicionado.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["cronograma"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cronograma").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro excluído.");
      qc.invalidateQueries({ queryKey: ["cronograma"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cronograma</h1>
          <p className="text-muted-foreground">
            Simulado Regional de Ciências da Natureza e Ciências Humanas — CREDE 3
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Nova ação</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar ação" : "Nova ação"}</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
              >
                <div className="space-y-1.5">
                  <Label>Período (rótulo exibido)</Label>
                  <Input value={form.periodo_label} onChange={(e) => setForm({ ...form, periodo_label: e.target.value })} placeholder="Ex.: 1 a 30/julho" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Data início</Label>
                    <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data fim</Label>
                    <Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Ação</Label>
                  <Textarea value={form.acao} onChange={(e) => setForm({ ...form, acao: e.target.value })} required rows={3} />
                </div>
                <div className="space-y-1.5">
                  <Label>Responsáveis</Label>
                  <Textarea value={form.responsaveis} onChange={(e) => setForm({ ...form, responsaveis: e.target.value })} required rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ordem</Label>
                  <Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ações programadas</CardTitle>
          <CardDescription>
            Status atualizado automaticamente: <span className="text-red-700">Pendente</span> (antes do período),{" "}
            <span className="text-yellow-700">Em Processo</span> (durante o período),{" "}
            <span className="text-green-700">Realizada</span> (após o período).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {itemsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Data/Período</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead className="w-[220px]">Responsáveis</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  {isAdmin && <TableHead className="w-[110px] text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsQ.data?.map((it) => {
                  const status = computeStatus(it.data_inicio, it.data_fim);
                  return (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium">{it.periodo_label}</TableCell>
                      <TableCell className="whitespace-pre-wrap">{it.acao}</TableCell>
                      <TableCell className="whitespace-pre-wrap text-sm text-muted-foreground">{it.responsaveis}</TableCell>
                      <TableCell><StatusBadge status={status} /></TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="outline" onClick={() => openEdit(it)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              title="Excluir"
                              onClick={() => {
                                if (confirm("Excluir esta ação do cronograma?")) del.mutate(it.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {itemsQ.data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground py-6">
                      Nenhuma ação cadastrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
