import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Trash2, ChevronDown, ChevronRight, Database, ListChecks, UserPlus, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";

import {
  listImportacoes,
  listImportacaoAlunos,
  deleteImportacao,
  deleteTodasImportacoes,
  deleteImportacaoAluno,
  updateImportacaoAluno,
  getRespostasAluno,
  updateRespostasAluno,
  addAlunoAusente,
  fecharLote,
  reabrirLote,
} from "@/lib/offline.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Lote = {
  simulado_id: string;
  turma_id: string;
  simulado: string;
  turma: string;
  escola: string;
  inep: string;
  alunos: number;
  ausentes?: number;
  respostas: number;
  ultima: string;
  fechado?: boolean;
  fechado_em?: string | null;
};


type AlunoLote = {
  numero_chamada: number;
  nome: string | null;
  respostas: number;
  ausente: boolean;
};


export function ImportacoesManager({ isAdmin = true }: { isAdmin?: boolean } = {}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listImportacoes);
  const delLoteFn = useServerFn(deleteImportacao);
  const delTudoFn = useServerFn(deleteTodasImportacoes);
  const fecharFn = useServerFn(fecharLote);
  const reabrirFn = useServerFn(reabrirLote);

  const lotesQ = useQuery({
    queryKey: ["importacoes"],
    queryFn: () => listFn({}),
  });

  const [openKey, setOpenKey] = useState<string | null>(null);

  const delLote = useMutation({
    mutationFn: (l: Lote) =>
      delLoteFn({ data: { simuladoId: l.simulado_id, turmaId: l.turma_id } }),
    onSuccess: (r) => {
      toast.success(`Lote excluído (${r.removidas} respostas).`);
      qc.invalidateQueries({ queryKey: ["importacoes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const delTudo = useMutation({
    mutationFn: () => delTudoFn({}),
    onSuccess: (r) => {
      toast.success(`Importações zeradas (${r.removidas} respostas removidas).`);
      qc.invalidateQueries({ queryKey: ["importacoes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <CardTitle>Importações de respostas</CardTitle>
        </div>
        <CardDescription>
          Edite ou exclua respostas importadas das planilhas, por lote (simulado + turma) ou por aluno.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {lotesQ.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        )}
        {lotesQ.data?.length === 0 && (
          <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-muted-foreground">
              Nenhum lote apareceu na listagem. Se você quer limpar os dados de teste já importados, use a opção abaixo.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={delTudo.isPending}>
                  <Trash2 className="mr-2 h-4 w-4" /> Zerar todas as importações
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Zerar todas as respostas importadas?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todas as respostas importadas por planilha serão removidas do sistema. Essa ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => delTudo.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Zerar importações
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
        <div className="space-y-2">
          {(lotesQ.data ?? []).map((l) => {
            const key = `${l.simulado_id}::${l.turma_id}`;
            const open = openKey === key;
            return (
              <div key={key} className="rounded-md border">
                <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => setOpenKey(open ? null : key)}
                    className="flex flex-1 items-start gap-2 text-left"
                  >
                    {open ? (
                      <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l.simulado}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.escola} · INEP {l.inep} · Turma {l.turma}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {l.alunos} aluno(s){l.ausentes ? ` · ${l.ausentes} ausente(s)` : ""} · {l.respostas} resposta(s) ·{" "}
                        última: {new Date(l.ultima).toLocaleString("pt-BR")}
                      </p>

                    </div>
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="mr-1 h-4 w-4" /> Excluir lote
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir lote inteiro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Todas as {l.respostas} respostas dos {l.alunos} alunos
                          deste simulado nesta turma serão removidas. Essa ação
                          não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => delLote.mutate(l)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                {open && <LoteAlunos lote={l} />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function LoteAlunos({ lote }: { lote: Lote }) {
  const qc = useQueryClient();
  const listAlunosFn = useServerFn(listImportacaoAlunos);
  const updFn = useServerFn(updateImportacaoAluno);
  const delAlunoFn = useServerFn(deleteImportacaoAluno);

  const alunosQ = useQuery({
    queryKey: ["importacao-alunos", lote.simulado_id, lote.turma_id],
    queryFn: () =>
      listAlunosFn({ data: { simuladoId: lote.simulado_id, turmaId: lote.turma_id } }),
  });

  const [editing, setEditing] = useState<number | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editNumero, setEditNumero] = useState<number>(0);
  const [editAnswersFor, setEditAnswersFor] = useState<number | null>(null);


  const startEdit = (a: AlunoLote) => {
    setEditing(a.numero_chamada);
    setEditNome(a.nome ?? "");
    setEditNumero(a.numero_chamada);
  };

  const upd = useMutation({
    mutationFn: () =>
      updFn({
        data: {
          simuladoId: lote.simulado_id,
          turmaId: lote.turma_id,
          numeroChamada: editing!,
          nome: editNome.trim() || null,
          novoNumero: editNumero,
        },
      }),
    onSuccess: () => {
      toast.success("Aluno atualizado.");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["importacao-alunos", lote.simulado_id, lote.turma_id] });
      qc.invalidateQueries({ queryKey: ["importacoes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: (numero: number) =>
      delAlunoFn({
        data: {
          simuladoId: lote.simulado_id,
          turmaId: lote.turma_id,
          numeroChamada: numero,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Aluno removido (${r.removidas} respostas).`);
      qc.invalidateQueries({ queryKey: ["importacao-alunos", lote.simulado_id, lote.turma_id] });
      qc.invalidateQueries({ queryKey: ["importacoes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const addFn = useServerFn(addAlunoAusente);
  const [novoNum, setNovoNum] = useState<string>("");
  const [novoNome, setNovoNome] = useState<string>("");
  const add = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          simuladoId: lote.simulado_id,
          turmaId: lote.turma_id,
          numeroChamada: parseInt(novoNum || "0", 10),
          nome: novoNome.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Aluno adicionado para 2ª chamada. Clique no ícone de respostas para registrá-las.");
      setNovoNum("");
      setNovoNome("");
      qc.invalidateQueries({ queryKey: ["importacao-alunos", lote.simulado_id, lote.turma_id] });
      qc.invalidateQueries({ queryKey: ["importacoes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });


  return (
    <div className="border-t bg-muted/30 p-3">
      {alunosQ.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando alunos...
        </div>
      )}
      <div className="space-y-1">
        {(alunosQ.data ?? []).map((a) => (
          <div
            key={a.numero_chamada}
            className="flex flex-wrap items-center gap-2 rounded border bg-card p-2 text-sm"
          >
            {editing === a.numero_chamada ? (
              <>
                <Input
                  type="number"
                  value={editNumero}
                  onChange={(e) => setEditNumero(parseInt(e.target.value || "0", 10))}
                  className="h-8 w-20"
                />
                <Input
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  placeholder="Nome do aluno"
                  className="h-8 flex-1 min-w-[180px]"
                />
                <Button size="sm" onClick={() => upd.mutate()} disabled={upd.isPending}>
                  {upd.isPending ? "Salvando..." : "Salvar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <span className="w-12 font-mono text-xs">nº {a.numero_chamada}</span>
                <span className="flex-1 truncate">
                  {a.nome ?? <span className="italic text-muted-foreground">Nome não informado</span>}
                </span>
                {a.ausente ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                    Ausente
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">{a.respostas} resp.</span>
                <Button
                  size="sm"
                  variant={a.ausente ? "default" : "outline"}
                  onClick={() => setEditAnswersFor(a.numero_chamada)}
                  title={a.ausente ? "Inserir respostas da 2ª chamada" : "Editar respostas"}
                >
                  <ListChecks className="h-3.5 w-3.5" />
                </Button>

                <Button size="sm" variant="outline" onClick={() => startEdit(a)} title="Editar nome / nº">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir respostas deste aluno?</AlertDialogTitle>
                      <AlertDialogDescription>
                        As {a.respostas} respostas do aluno nº {a.numero_chamada}
                        {a.nome ? ` (${a.nome})` : ""} neste simulado/turma serão removidas.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => del.mutate(a.numero_chamada)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        ))}
      </div>

      {(() => {
        const nParsed = parseInt(novoNum || "0", 10);
        const existentes = new Set((alunosQ.data ?? []).map((a) => a.numero_chamada));
        const duplicado = nParsed > 0 && existentes.has(nParsed);
        return (
          <form
            className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-dashed bg-card/50 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nParsed || nParsed < 1) {
                toast.error("Informe um nº de chamada válido.");
                return;
              }
              if (duplicado) {
                toast.error(`O nº ${nParsed} já existe nesta lista importada.`);
                return;
              }
              add.mutate();
            }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <UserPlus className="h-4 w-4 text-primary" />
              Adicionar aluno (2ª chamada)
            </div>
            <Input
              type="number"
              min={1}
              value={novoNum}
              onChange={(e) => setNovoNum(e.target.value)}
              placeholder="nº"
              className={`h-8 w-20 ${duplicado ? "border-destructive focus-visible:ring-destructive" : ""}`}
              aria-invalid={duplicado}
            />
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Nome do aluno"
              className="h-8 min-w-[200px] flex-1"
            />
            <Button type="submit" size="sm" disabled={add.isPending || duplicado || !nParsed}>
              {add.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
            {duplicado && (
              <p className="w-full text-xs text-destructive">
                O nº {nParsed} já existe nesta lista importada. Escolha outro número de chamada.
              </p>
            )}
          </form>
        );
      })()}


      <EditAnswersDialog
        open={editAnswersFor !== null}
        onClose={() => setEditAnswersFor(null)}
        simuladoId={lote.simulado_id}
        turmaId={lote.turma_id}
        numeroChamada={editAnswersFor}
        nome={(alunosQ.data ?? []).find((x) => x.numero_chamada === editAnswersFor)?.nome ?? null}
      />
    </div>
  );
}

const ALTS = ["A", "B", "C", "D", "E"] as const;

function EditAnswersDialog({
  open,
  onClose,
  simuladoId,
  turmaId,
  numeroChamada,
  nome,
}: {
  open: boolean;
  onClose: () => void;
  simuladoId: string;
  turmaId: string;
  numeroChamada: number | null;
  nome: string | null;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getRespostasAluno);
  const updFn = useServerFn(updateRespostasAluno);

  const q = useQuery({
    queryKey: ["respostas-aluno", simuladoId, turmaId, numeroChamada],
    queryFn: () =>
      getFn({ data: { simuladoId, turmaId, numeroChamada: numeroChamada! } }),
    enabled: open && numeroChamada !== null,
  });

  const [edits, setEdits] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (q.data) {
      const init: Record<string, string | null> = {};
      for (const it of q.data.questoes) init[it.questao_id] = it.resposta_escolhida;
      setEdits(init);
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      updFn({
        data: {
          simuladoId,
          turmaId,
          numeroChamada: numeroChamada!,
          respostas: Object.entries(edits).map(([questao_id, resposta_escolhida]) => ({
            questao_id,
            resposta_escolhida,
          })),
        },
      }),
    onSuccess: (r) => {
      toast.success(`Respostas atualizadas (${r.total} marcadas).`);
      qc.invalidateQueries({ queryKey: ["importacao-alunos", simuladoId, turmaId] });
      qc.invalidateQueries({ queryKey: ["importacoes"] });
      qc.invalidateQueries({ queryKey: ["respostas-aluno", simuladoId, turmaId, numeroChamada] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Editar respostas — nº {numeroChamada}
            {nome ? ` · ${nome}` : ""}
          </DialogTitle>
          <DialogDescription>
            Apenas as respostas marcadas pelo(a) aluno(a) são exibidas. Clique numa alternativa
            para alterar; clique na mesma alternativa para deixar em branco.
          </DialogDescription>

        </DialogHeader>

        {q.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando respostas...
          </div>
        )}

        {q.data && (
          <div className="max-h-[60vh] space-y-1 overflow-auto pr-2">
            {q.data.questoes.map((it) => {
              const sel = edits[it.questao_id] ?? null;
              return (
                <div
                  key={it.questao_id}
                  className="flex items-center gap-2 rounded border p-2 text-sm"
                >
                  <span className="w-10 font-mono text-xs text-muted-foreground">
                    Q{it.numero}
                  </span>
                  <div className="flex flex-1 flex-wrap gap-1">
                    {ALTS.map((alt) => {
                      const isSel = sel === alt;
                      return (
                        <button
                          key={alt}
                          type="button"
                          onClick={() =>
                            setEdits((prev) => ({
                              ...prev,
                              [it.questao_id]: prev[it.questao_id] === alt ? null : alt,
                            }))
                          }
                          className={
                            "h-8 w-8 rounded border text-xs font-semibold transition-colors " +
                            (isSel
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-card hover:bg-muted")
                          }
                        >
                          {alt}
                        </button>
                      );
                    })}
                  </div>
                  <span className="w-16 text-right text-xs text-muted-foreground">
                    {sel ? `Marcada: ${sel}` : "Em branco"}
                  </span>

                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !q.data}>
            {save.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

