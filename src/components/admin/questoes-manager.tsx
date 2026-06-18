import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, ListChecks } from "lucide-react";
import { toast } from "sonner";

import {
  listQuestoes,
  upsertQuestao,
  deleteQuestao,
} from "@/lib/offline.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type Simulado = { id: string; offer: string; subject: string; grade: string };

const empty = {
  numero: 1,
  enunciado: "",
  alternativa_a: "",
  alternativa_b: "",
  alternativa_c: "",
  alternativa_d: "",
  alternativa_e: "",
  resposta_correta: "A" as "A" | "B" | "C" | "D" | "E",
  pontos: 1,
};

export function QuestoesManager({ simulados }: { simulados: Simulado[] }) {
  const qc = useQueryClient();
  const [simuladoId, setSimuladoId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const listFn = useServerFn(listQuestoes);
  const upsertFn = useServerFn(upsertQuestao);
  const delFn = useServerFn(deleteQuestao);

  const questoesQ = useQuery({
    queryKey: ["questoes", simuladoId],
    queryFn: () => listFn({ data: { simuladoId } }),
    enabled: !!simuladoId,
  });

  const upsert = useMutation({
    mutationFn: (payload: any) => upsertFn({ data: payload }),
    onSuccess: () => {
      toast.success("Questão salva.");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["questoes", simuladoId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Questão removida.");
      qc.invalidateQueries({ queryKey: ["questoes", simuladoId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function openNew() {
    const nextNumero = (questoesQ.data?.length ?? 0) + 1;
    setEditing({ ...empty, numero: nextNumero, simulado_id: simuladoId });
    setOpen(true);
  }

  function openEdit(q: any) {
    setEditing({ ...q, alternativa_e: q.alternativa_e ?? "" });
    setOpen(true);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    upsert.mutate({
      ...editing,
      simulado_id: simuladoId,
      numero: Number(editing.numero),
      pontos: Number(editing.pontos),
      ordem: Number(editing.numero),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-5 w-5" /> Gabarito / Questões por simulado
        </CardTitle>
        <CardDescription>
          Cadastre o número da questão, alternativas, resposta correta e pontos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Select value={simuladoId} onValueChange={setSimuladoId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um simulado..." />
            </SelectTrigger>
            <SelectContent>
              {simulados.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.offer} · {s.subject} · {s.grade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openNew} disabled={!simuladoId}>
            <Plus className="mr-2 h-4 w-4" /> Nova questão
          </Button>
        </div>

        {simuladoId && (
          <div className="max-h-96 overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Nº</th>
                  <th className="px-3 py-2">Enunciado</th>
                  <th className="px-3 py-2 text-center">Resposta</th>
                  <th className="px-3 py-2 text-right">Pontos</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(questoesQ.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      Nenhuma questão cadastrada.
                    </td>
                  </tr>
                )}
                {questoesQ.data?.map((q: any) => (
                  <tr key={q.id} className="border-t">
                    <td className="px-3 py-2 font-mono">{q.numero}</td>
                    <td className="max-w-md truncate px-3 py-2">{q.enunciado}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge>{q.resposta_correta}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">{q.pontos}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(q)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remover questão ${q.numero}?`)) del.mutate(q.id);
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editing?.id ? "Editar questão" : "Nova questão"}
              </DialogTitle>
            </DialogHeader>
            {editing && (
              <form onSubmit={save} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nº</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editing.numero}
                      onChange={(e) =>
                        setEditing({ ...editing, numero: Number(e.target.value) })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Resposta correta</Label>
                    <Select
                      value={editing.resposta_correta}
                      onValueChange={(v) =>
                        setEditing({ ...editing, resposta_correta: v as any })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["A", "B", "C", "D", "E"].map((l) => (
                          <SelectItem key={l} value={l}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pontos</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editing.pontos}
                      onChange={(e) =>
                        setEditing({ ...editing, pontos: Number(e.target.value) })
                      }
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Enunciado</Label>
                  <Textarea
                    rows={3}
                    value={editing.enunciado}
                    onChange={(e) =>
                      setEditing({ ...editing, enunciado: e.target.value })
                    }
                    required
                  />
                </div>
                {(["a", "b", "c", "d", "e"] as const).map((l) => (
                  <div key={l} className="space-y-1.5">
                    <Label>
                      Alternativa {l.toUpperCase()}
                      {l === "e" && " (opcional)"}
                    </Label>
                    <Input
                      value={editing[`alternativa_${l}`] ?? ""}
                      onChange={(e) =>
                        setEditing({ ...editing, [`alternativa_${l}`]: e.target.value })
                      }
                      required={l !== "e"}
                    />
                  </div>
                ))}
                <Button type="submit" disabled={upsert.isPending} className="w-full">
                  {upsert.isPending ? "Salvando..." : "Salvar questão"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
