import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getMyProfile, listSchools } from "@/lib/prisma.functions";
import { listTurmas } from "@/lib/turmas.functions";
import {
  listDevolutivas,
  createDevolutiva,
  updateDevolutivaStatus,
  deleteDevolutiva,
  listRespostasDevolutiva,
  addRespostaDevolutiva,
} from "@/lib/devolutivas.functions";

export const Route = createFileRoute("/_authenticated/devolutivas")({
  component: Page,
});

const STATUS_LABEL = {
  enviada: "Enviada",
  em_processo: "Em Processo",
  finalizada: "Finalizada",
} as const;

const STATUS_COLOR: Record<keyof typeof STATUS_LABEL, string> = {
  enviada: "bg-red-100 text-red-800 border-red-200",
  em_processo: "bg-amber-100 text-amber-800 border-amber-200",
  finalizada: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function Page() {
  const qc = useQueryClient();
  const getProfile = useServerFn(getMyProfile);
  const getSchools = useServerFn(listSchools);
  const getTurmas = useServerFn(listTurmas);
  const getList = useServerFn(listDevolutivas);
  const createFn = useServerFn(createDevolutiva);
  const updateStatusFn = useServerFn(updateDevolutivaStatus);
  const deleteFn = useServerFn(deleteDevolutiva);
  const listRespFn = useServerFn(listRespostasDevolutiva);
  const addRespFn = useServerFn(addRespostaDevolutiva);

  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => getProfile() });
  const roles: string[] = (profileQ.data?.roles as string[] | undefined) ?? [];
  const isAdmin = roles.includes("admin");
  const isSuper = roles.includes("superintendente");
  const isGestor = roles.includes("gestor");
  const isProfResp = roles.includes("professor_responsavel");
  const canCreate = isAdmin || isSuper;
  const canChangeStatus = isAdmin || isGestor || isProfResp;

  const schoolsQ = useQuery({
    queryKey: ["schools"],
    queryFn: () => getSchools(),
    enabled: canCreate,
  });
  const devsQ = useQuery({ queryKey: ["devolutivas"], queryFn: () => getList() });

  // form
  const [schoolId, setSchoolId] = useState<string>("");
  const [turmaId, setTurmaId] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const turmasQ = useQuery({
    queryKey: ["turmas", schoolId],
    queryFn: () => getTurmas({ data: { schoolId } }),
    enabled: !!schoolId,
  });

  const createM = useMutation({
    mutationFn: async () =>
      createFn({
        data: {
          school_id: schoolId,
          turma_id: turmaId || null,
          titulo,
          mensagem,
        },
      }),
    onSuccess: () => {
      toast.success("Devolutiva enviada");
      setTitulo("");
      setMensagem("");
      setTurmaId("");
      qc.invalidateQueries({ queryKey: ["devolutivas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const statusM = useMutation({
    mutationFn: async (v: { id: string; status: keyof typeof STATUS_LABEL }) =>
      updateStatusFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devolutivas"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devolutivas"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const [openId, setOpenId] = useState<string | null>(null);
  const [novaResp, setNovaResp] = useState("");
  const respQ = useQuery({
    queryKey: ["devolutiva-respostas", openId],
    queryFn: () => listRespFn({ data: { devolutiva_id: openId! } }),
    enabled: !!openId,
  });
  const addRespM = useMutation({
    mutationFn: async () =>
      addRespFn({ data: { devolutiva_id: openId!, mensagem: novaResp } }),
    onSuccess: () => {
      setNovaResp("");
      qc.invalidateQueries({ queryKey: ["devolutiva-respostas", openId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const list = useMemo(() => devsQ.data ?? [], [devsQ.data]);
  const opened = list.find((d: any) => d.id === openId);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Devolutivas</h1>
        <p className="text-sm text-muted-foreground">
          Orientações, devolutivas e solicitações da Superintendência Escolar.
        </p>
      </div>

      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova devolutiva</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Escola</Label>
              <Select value={schoolId} onValueChange={(v) => { setSchoolId(v); setTurmaId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(schoolsQ.data ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Turma (opcional)</Label>
              <Select value={turmaId} onValueChange={setTurmaId} disabled={!schoolId}>
                <SelectTrigger><SelectValue placeholder="Toda a escola" /></SelectTrigger>
                <SelectContent>
                  {(turmasQ.data ?? []).map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome} · {t.ano} · {t.turno}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Mensagem</Label>
              <Textarea rows={4} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Button
                onClick={() => createM.mutate()}
                disabled={!schoolId || !titulo.trim() || !mensagem.trim() || createM.isPending}
              >
                Enviar devolutiva
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Devolutivas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {devsQ.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!devsQ.isLoading && list.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma devolutiva.</p>
          )}
          {list.map((d: any) => (
            <div key={d.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{d.titulo}</h3>
                    <Badge variant="outline" className={STATUS_COLOR[d.status as keyof typeof STATUS_LABEL]}>
                      {STATUS_LABEL[d.status as keyof typeof STATUS_LABEL]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {d.school_name}
                    {d.turma_label ? ` · ${d.turma_label}` : ""}
                    {d.autor_nome ? ` · ${d.autor_nome}` : ""}
                    {" · "}
                    {new Date(d.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {canChangeStatus && (
                    <Select
                      value={d.status}
                      onValueChange={(v) =>
                        statusM.mutate({ id: d.id, status: v as keyof typeof STATUS_LABEL })
                      }
                    >
                      <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABEL).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setOpenId(d.id)}>
                    Comentários
                  </Button>
                  {(isAdmin || d.autor_id === (profileQ.data as any)?.id) && (
                    <Button size="sm" variant="ghost" onClick={() => deleteM.mutate(d.id)}>
                      Excluir
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{d.mensagem}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{opened?.titulo ?? "Devolutiva"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {(respQ.data ?? []).map((r: any) => (
              <div key={r.id} className="rounded-md border bg-muted/30 p-2 text-sm">
                <p className="text-xs text-muted-foreground">
                  {r.autor_nome ?? "—"} · {new Date(r.created_at).toLocaleString("pt-BR")}
                </p>
                <p className="whitespace-pre-wrap">{r.mensagem}</p>
              </div>
            ))}
            {!respQ.isLoading && (respQ.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Sem comentários ainda.</p>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Textarea
              rows={3}
              value={novaResp}
              onChange={(e) => setNovaResp(e.target.value)}
              placeholder="Escreva um comentário…"
            />
            <Button
              onClick={() => addRespM.mutate()}
              disabled={!novaResp.trim() || addRespM.isPending}
            >
              Enviar comentário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
