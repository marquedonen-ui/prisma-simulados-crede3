import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Save } from "lucide-react";
import { toast } from "sonner";

import { listQuestoes, saveGabarito } from "@/lib/offline.functions";
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
import { cn } from "@/lib/utils";

type Simulado = { id: string; offer: string; subject: string; grade: string };
type Letter = "A" | "B" | "C" | "D" | "E";
const LETTERS: Letter[] = ["A", "B", "C", "D", "E"];

export function QuestoesManager({ simulados }: { simulados: Simulado[] }) {
  const qc = useQueryClient();
  const [simuladoId, setSimuladoId] = useState<string>("");
  const [total, setTotal] = useState<number>(20);
  const [answers, setAnswers] = useState<Record<number, Letter>>({});

  const listFn = useServerFn(listQuestoes);
  const saveFn = useServerFn(saveGabarito);

  const questoesQ = useQuery({
    queryKey: ["questoes", simuladoId],
    queryFn: () => listFn({ data: { simuladoId } }),
    enabled: !!simuladoId,
  });

  // Hidrata estado ao trocar simulado / carregar dados
  useEffect(() => {
    const rows = questoesQ.data ?? [];
    if (!simuladoId) {
      setAnswers({});
      return;
    }
    const map: Record<number, Letter> = {};
    let max = 0;
    for (const q of rows as any[]) {
      map[q.numero] = q.resposta_correta as Letter;
      if (q.numero > max) max = q.numero;
    }
    setAnswers(map);
    if (max > 0) setTotal(max);
  }, [simuladoId, questoesQ.data]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        simulado_id: simuladoId,
        total,
        answers: Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          return { numero: n, resposta_correta: (answers[n] ?? "A") as Letter };
        }),
      };
      return saveFn({ data: payload });
    },
    onSuccess: () => {
      toast.success("Gabarito salvo.");
      qc.invalidateQueries({ queryKey: ["questoes", simuladoId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const marcadas = useMemo(
    () => Array.from({ length: total }, (_, i) => i + 1).filter((n) => !!answers[n]).length,
    [answers, total],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-5 w-5" /> Gabarito / Questões por simulado
        </CardTitle>
        <CardDescription>
          Defina a quantidade total de questões e marque a alternativa correta de cada uma.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <div className="space-y-1.5">
            <Label>Simulado</Label>
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
          </div>
          <div className="space-y-1.5">
            <Label>Total de questões</Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={total}
              onChange={(e) => setTotal(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              disabled={!simuladoId}
            />
          </div>
        </div>

        {simuladoId && (
          <>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Marcadas: <strong className="text-foreground">{marcadas}</strong> de{" "}
                <strong className="text-foreground">{total}</strong>
              </span>
              <Button
                size="sm"
                onClick={() => save.mutate()}
                disabled={save.isPending || questoesQ.isLoading}
              >
                <Save className="mr-2 h-4 w-4" />
                {save.isPending ? "Salvando..." : "Salvar gabarito"}
              </Button>
            </div>

            <div className="overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Questão</th>
                    {LETTERS.map((l) => (
                      <th key={l} className="px-3 py-2 text-center">
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
                    const selected = answers[n];
                    return (
                      <tr key={n} className="border-t">
                        <td className="px-3 py-1.5 font-mono font-medium">{n}</td>
                        {LETTERS.map((l) => {
                          const isSel = selected === l;
                          return (
                            <td key={l} className="px-3 py-1.5 text-center">
                              <button
                                type="button"
                                aria-label={`Questão ${n} alternativa ${l}`}
                                onClick={() =>
                                  setAnswers((prev) => ({ ...prev, [n]: l }))
                                }
                                className={cn(
                                  "inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition",
                                  isSel
                                    ? "border-primary bg-primary text-primary-foreground shadow"
                                    : "border-muted-foreground/30 bg-background text-muted-foreground hover:border-primary/60 hover:text-foreground",
                                )}
                              >
                                {l}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
