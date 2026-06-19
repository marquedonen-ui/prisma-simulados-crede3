import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Users, Loader2, Filter, X, Download } from "lucide-react";
import {
  listSimuladosComRespostas,
  getResultadosAlunos,
} from "@/lib/relatorios.functions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Route = createFileRoute("/_authenticated/relatorios-alunos")({
  head: () => ({ meta: [{ title: "Resultados por Aluno — PRISMA" }] }),
  component: Page,
});

type Padrao = "muito_critico" | "critico" | "intermediario" | "adequado";

const PADRAO_INFO: Record<Padrao, { label: string; color: string; badge: string }> = {
  muito_critico: {
    label: "Muito Crítico",
    color: "#ef4444",
    badge: "bg-red-100 text-red-800 border-red-200",
  },
  critico: {
    label: "Crítico",
    color: "#eab308",
    badge: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  intermediario: {
    label: "Intermediário",
    color: "#22c55e",
    badge: "bg-green-100 text-green-800 border-green-200",
  },
  adequado: {
    label: "Adequado",
    color: "#3b82f6",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
  },
};

function Page() {
  const listSimFn = useServerFn(listSimuladosComRespostas);
  const getResFn = useServerFn(getResultadosAlunos);

  const [simuladoId, setSimuladoId] = useState("");
  const [busca, setBusca] = useState("");
  const [escolas, setEscolas] = useState<Set<string>>(new Set());
  const [turmas, setTurmas] = useState<Set<string>>(new Set());
  const [padroes, setPadroes] = useState<Set<Padrao>>(new Set());
  const [pctRange, setPctRange] = useState<[number, number]>([0, 100]);

  const simQ = useQuery({ queryKey: ["rel-sims"], queryFn: () => listSimFn() });
  const dadosQ = useQuery({
    queryKey: ["resultados-alunos", simuladoId],
    queryFn: () => getResFn({ data: { simuladoId } }),
    enabled: !!simuladoId,
  });

  const alunos = dadosQ.data?.alunos ?? [];

  const escolasDisponiveis = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of alunos) m.set(a.school_id ?? "sem", a.school_name);
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [alunos]);

  const turmasDisponiveis = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of alunos) {
      if (escolas.size > 0 && !escolas.has(a.school_id ?? "sem")) continue;
      m.set(a.turma_id, a.turma_nome);
    }
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [alunos, escolas]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return alunos.filter((a) => {
      if (escolas.size > 0 && !escolas.has(a.school_id ?? "sem")) return false;
      if (turmas.size > 0 && !turmas.has(a.turma_id)) return false;
      if (padroes.size > 0 && !padroes.has(a.padrao)) return false;
      if (a.pct_acerto < pctRange[0] || a.pct_acerto > pctRange[1]) return false;
      if (q) {
        const hay =
          `${a.nome ?? ""} ${a.numero_chamada} ${a.turma_nome} ${a.school_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [alunos, escolas, turmas, padroes, pctRange, busca]);

  function toggle<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
    const n = new Set(set);
    if (n.has(val)) n.delete(val);
    else n.add(val);
    setter(n);
  }

  function limpar() {
    setBusca("");
    setEscolas(new Set());
    setTurmas(new Set());
    setPadroes(new Set());
    setPctRange([0, 100]);
  }

  function exportarCSV() {
    const header = [
      "Escola",
      "Município",
      "Turma",
      "Nº Chamada",
      "Nome",
      "Acertos",
      "Total",
      "% Acerto",
      "Padrão",
    ];
    const linhas = filtrados.map((a) =>
      [
        `"${a.school_name.replace(/"/g, '""')}"`,
        `"${a.city.replace(/"/g, '""')}"`,
        `"${a.turma_nome.replace(/"/g, '""')}"`,
        a.numero_chamada,
        `"${(a.nome ?? "").replace(/"/g, '""')}"`,
        a.acertos,
        a.total_questoes,
        `${a.pct_acerto}%`,
        PADRAO_INFO[a.padrao].label,
      ].join(","),
    );
    const csv = [header.join(","), ...linhas].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resultados-alunos.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtrosAtivos =
    escolas.size + turmas.size + padroes.size +
    (pctRange[0] !== 0 || pctRange[1] !== 100 ? 1 : 0) +
    (busca ? 1 : 0);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-6">
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-primary">
          <Users className="h-3.5 w-3.5" /> Resultados Individuais
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          Resultados por Aluno
        </h1>
        <p className="mt-1 text-muted-foreground">
          Filtre por escola, padrão de desempenho, % de acerto, turma e aluno.
        </p>
      </header>

      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-1.5">
              <Label>Simulado</Label>
              <Select value={simuladoId} onValueChange={setSimuladoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um simulado..." />
                </SelectTrigger>
                <SelectContent>
                  {(simQ.data ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.offer} · {s.subject} · {s.grade} ({s.alunos_distintos} aluno(s))
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={exportarCSV}
              disabled={filtrados.length === 0}
            >
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar de filtros */}
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Filter className="h-4 w-4" /> Filtros
                  {filtrosAtivos > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {filtrosAtivos}
                    </Badge>
                  )}
                </CardTitle>
                {filtrosAtivos > 0 && (
                  <Button variant="ghost" size="sm" onClick={limpar}>
                    <X className="mr-1 h-3 w-3" /> Limpar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Buscar aluno
                </Label>
                <Input
                  placeholder="Nome ou nº de chamada"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>

              <FilterSection
                label="Padrão de Desempenho"
                emptyHint="—"
                disabled={!simuladoId}
              >
                {(Object.keys(PADRAO_INFO) as Padrao[]).map((p) => {
                  const info = PADRAO_INFO[p];
                  const count = alunos.filter((a) => a.padrao === p).length;
                  return (
                    <label
                      key={p}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={padroes.has(p)}
                        onCheckedChange={() => toggle(padroes, p, setPadroes)}
                      />
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: info.color }}
                      />
                      <span className="flex-1">{info.label}</span>
                      <span className="text-xs text-muted-foreground">{count}</span>
                    </label>
                  );
                })}
              </FilterSection>

              <FilterSection
                label={`% de Acerto (${pctRange[0]}% – ${pctRange[1]}%)`}
                disabled={!simuladoId}
              >
                <div className="px-1 pt-3">
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={pctRange}
                    onValueChange={(v) => setPctRange([v[0], v[1]] as [number, number])}
                  />
                </div>
              </FilterSection>

              <FilterSection
                label="Escola"
                emptyHint="Sem dados"
                disabled={escolasDisponiveis.length === 0}
              >
                <ScrollArea className="h-44 pr-2">
                  <div className="space-y-1">
                    {escolasDisponiveis.map((e) => (
                      <label
                        key={e.id}
                        className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={escolas.has(e.id)}
                          onCheckedChange={() => toggle(escolas, e.id, setEscolas)}
                          className="mt-0.5"
                        />
                        <span className="flex-1 leading-tight">{e.name}</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </FilterSection>

              <FilterSection
                label="Turma"
                emptyHint="Selecione escola(s)"
                disabled={turmasDisponiveis.length === 0}
              >
                <ScrollArea className="h-32 pr-2">
                  <div className="space-y-1">
                    {turmasDisponiveis.map((t) => (
                      <label
                        key={t.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={turmas.has(t.id)}
                          onCheckedChange={() => toggle(turmas, t.id, setTurmas)}
                        />
                        <span className="flex-1">{t.name}</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </FilterSection>
            </CardContent>
          </Card>
        </aside>

        {/* Conteúdo */}
        <section>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Alunos</CardTitle>
                  <CardDescription>
                    {!simuladoId
                      ? "Selecione um simulado para visualizar."
                      : `${filtrados.length} de ${alunos.length} aluno(s)`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!simuladoId ? (
                <p className="py-10 text-center text-muted-foreground">
                  Selecione um simulado acima.
                </p>
              ) : dadosQ.isLoading ? (
                <div className="flex items-center gap-2 py-10 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando alunos...
                </div>
              ) : filtrados.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">
                  Nenhum aluno corresponde aos filtros.
                </p>
              ) : (
                <div className="overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aluno</TableHead>
                        <TableHead>Escola / Turma</TableHead>
                        <TableHead className="text-right">Acertos</TableHead>
                        <TableHead className="text-right">% Acerto</TableHead>
                        <TableHead>Padrão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtrados.map((a) => {
                        const info = PADRAO_INFO[a.padrao];
                        return (
                          <TableRow key={`${a.turma_id}-${a.numero_chamada}`}>
                            <TableCell>
                              <div className="font-medium">
                                {a.nome ?? (
                                  <span className="italic text-muted-foreground">
                                    Nome não informado
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Nº de chamada: {a.numero_chamada}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="text-sm">{a.school_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {a.turma_nome}
                                {a.city ? ` · ${a.city}` : ""}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {a.acertos}/{a.total_questoes}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {a.pct_acerto}%
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={info.badge}>
                                {info.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function FilterSection({
  label,
  children,
  emptyHint,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  emptyHint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {disabled ? (
        <p className="text-xs text-muted-foreground">{emptyHint ?? "—"}</p>
      ) : (
        children
      )}
    </div>
  );
}
