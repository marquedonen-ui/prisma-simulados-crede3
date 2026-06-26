import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, BarChart3, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { importarRespostas, countQuestoes } from "@/lib/offline.functions";
import { listTurmas } from "@/lib/turmas.functions";
import { Button } from "@/components/ui/button";
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

type Simulado = { id: string; offer: string; subject: string; grade: string };
type School = { id: string; name: string; inep: string };

export function ImportarRespostas({
  simulados,
  schools,
}: {
  simulados: Simulado[];
  schools: School[];
}) {
  const [simuladoId, setSimuladoId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [resultado, setResultado] = useState<any>(null);

  const importFn = useServerFn(importarRespostas);
  const listTurmasFn = useServerFn(listTurmas);
  const countQuestoesFn = useServerFn(countQuestoes);

  const turmasQ = useQuery({
    queryKey: ["turmas", schoolId],
    queryFn: () => listTurmasFn({ data: { schoolId } }),
    enabled: !!schoolId,
  });

  const questoesQ = useQuery({
    queryKey: ["questoes-count", simuladoId],
    queryFn: () => countQuestoesFn({ data: { simuladoId } }),
    enabled: !!simuladoId,
  });

  const semQuestoes = !!simuladoId && questoesQ.data?.total === 0;

  const importar = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione uma planilha.");
      if (!simuladoId) throw new Error("Selecione o simulado.");
      if (!schoolId) throw new Error("Selecione a escola.");
      if (!turmaId) throw new Error("Selecione a turma em que a avaliação foi aplicada.");

      const nome = file.name.toLowerCase();
      const ehXls = nome.endsWith(".xls");
      const ehCsv = nome.endsWith(".csv");

      let wb: XLSX.WorkBook;
      try {
        if (ehCsv) {
          const txt = await file.text();
          wb = XLSX.read(txt, { type: "string", raw: false });
        } else {
          const buf = new Uint8Array(await file.arrayBuffer());
          wb = XLSX.read(buf, { type: "array", cellDates: false, raw: false });
        }
      } catch {
        throw new Error(
          `Não foi possível ler o arquivo${ehXls ? " .xls" : ""}. Verifique se é uma planilha válida.`,
        );
      }

      if (!wb.SheetNames.length) throw new Error("Planilha sem abas.");
      const sheet = wb.Sheets[wb.SheetNames[0]];

      const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
        blankrows: false,
      });
      if (!matrix || matrix.length === 0) throw new Error("Planilha vazia.");

      const norm = (s: any) =>
        String(s ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^A-Za-z0-9]/g, "")
          .toUpperCase();

      // Identifica colunas Q N Options no cabeçalho.
      const qOptionsRe = /^Q(\d{1,3})(?:OPTIONS|OPTION|OPCOES|OPCAO|RESPOSTA|ALTERNATIVA)$/;
      const qSimpleRe = /^(?:Q|QUESTAO)(\d{1,3})$/;
      const isQKey = (k: string) => qOptionsRe.test(k) || qSimpleRe.test(k);

      let headerIdx = -1;
      for (let i = 0; i < Math.min(matrix.length, 30); i++) {
        const cells = matrix[i].map(norm);
        if (cells.some(isQKey)) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx === -1) headerIdx = 0;

      const headers = matrix[headerIdx].map(norm);

      // Auto-detect coluna de nº de chamada. Fallback: coluna C (índice 2).
      const chamadaPatterns = ["NUMDALISTA", "NUMLISTA", "NLISTA", "LISTA", "CHAMADA", "NUMCHAMADA", "NCHAMADA"];
      let chamadaCol = headers.findIndex((h) => chamadaPatterns.some((p) => h === p || h.includes(p)));
      if (chamadaCol === -1) chamadaCol = 2;

      // Auto-detect coluna de nome do aluno. Fallback: coluna D (índice 3).
      const nomePatterns = ["NOMEDOALUNO", "NOMEALUNO", "NOME", "ALUNO", "ESTUDANTE", "PARTICIPANTE"];
      let nomeCol = headers.findIndex((h) => nomePatterns.some((p) => h === p || h.includes(p)));
      if (nomeCol === -1) nomeCol = 3;

      const linhas: Array<{ numero_chamada: number; nome?: string; respostas: Record<string, string> }> = [];
      const ignoradas: Array<{ linha: number; motivo: string; nome?: string; chamadaRaw?: string }> = [];
      for (let r = headerIdx + 1; r < matrix.length; r++) {
        const row = matrix[r];
        const linhaPlanilha = r + 1; // 1-indexed para o usuário
        const rawChamada = String(row?.[chamadaCol] ?? "").trim();
        const nome = String(row?.[nomeCol] ?? "").trim().slice(0, 200) || undefined;
        if (!row || row.length === 0 || (!rawChamada && !nome)) continue; // linha totalmente vazia: silêncio
        const numero_chamada = parseInt(rawChamada.replace(/\D/g, ""), 10);
        if (!numero_chamada || numero_chamada < 1) {
          ignoradas.push({
            linha: linhaPlanilha,
            motivo: rawChamada ? `nº de chamada inválido ("${rawChamada}")` : "nº de chamada em branco",
            nome,
            chamadaRaw: rawChamada,
          });
          continue;
        }
        const respostas: Record<string, string> = {};
        for (let c = 0; c < headers.length; c++) {
          const h = headers[c];
          const mo = h.match(qOptionsRe) || h.match(qSimpleRe);
          if (!mo) continue;
          const num = parseInt(mo[1], 10);
          if (num > 0) {
            respostas[`Q${num}`] = String(row[c] ?? "").trim().toUpperCase();
          }
        }
        linhas.push({ numero_chamada, nome, respostas });
      }

      if (linhas.length === 0)
        throw new Error(
          "Nenhuma linha válida. Verifique se há coluna 'Núm. da lista' (ou nº de chamada na coluna C) e colunas 'Q N Options'.",
        );

      const resp = await importFn({ data: { simuladoId, schoolId, turmaId, linhas } });
      return { ...resp, linhas_ignoradas: ignoradas } as any;
    },
    onSuccess: (r) => {
      setResultado(r);
      const ign = r.linhas_ignoradas?.length ?? 0;
      toast.success(
        `${r.respostas_importadas} respostas de ${r.alunos_processados} aluno(s) importadas${ign ? ` · ${ign} linha(s) ignorada(s)` : ""}.`,
      );
    },

    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha na importação"),
  });

  function baixarModelo() {
    const numQuestoes = 45;
    const headers = [
      "Exame",
      "Conjunto de exames",
      "Núm. da lista",
      "Nome",
      "Total de marcas",
      "Nota",
      "Classificação",
      "Respostas corretas",
      "Respostas incorretas",
      "Not attempted",
      "Assunto 1",
    ];
    for (let i = 1; i <= numQuestoes; i++) {
      headers.push(`Q ${i} Options`, `Q ${i} Key`, `Q ${i} Marks`);
    }

    const exemplo: (string | number)[] = [
      "Simulado 1",
      "Conjunto A",
      1,
      "Aluno 1",
      40,
      8.9,
      1,
      40,
      5,
      0,
      "Geral",
    ];
    for (let i = 1; i <= numQuestoes; i++) {
      exemplo.push("A", "A", 1);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, exemplo]);
    XLSX.utils.book_append_sheet(wb, ws, "Reports");
    XLSX.writeFile(wb, "modelo-cartao-resposta.xlsx");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" /> Importar cartões-resposta (offline)
        </CardTitle>
        <CardDescription>
          Faça upload da planilha preenchida pela escola. As respostas são vinculadas à turma
          escolhida, sem necessidade de cadastro de alunos. A coluna C identifica o aluno (nº de chamada).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={baixarModelo}>
            <Download className="mr-2 h-4 w-4" /> Baixar modelo (XLSX)
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Simulado</Label>
            <Select value={simuladoId} onValueChange={setSimuladoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
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
            <Label>Escola</Label>
            <Select
              value={schoolId}
              onValueChange={(v) => {
                setSchoolId(v);
                setTurmaId("");
              }}
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
        </div>

        {semQuestoes && (
          <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-amber-700 dark:text-amber-400">
                Este simulado ainda não tem questões cadastradas
              </p>
              <p className="mt-1 text-muted-foreground">
                Cadastre as questões (com o gabarito A–E) antes de importar a planilha. Sem o
                gabarito, o sistema não consegue validar as respostas e nenhuma será gravada.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link to="/admin">Ir para o painel de administração</Link>
              </Button>
            </div>
          </div>
        )}


        <div className="space-y-1.5">
          <Label>Turma em que a avaliação foi aplicada</Label>
          <Select value={turmaId} onValueChange={setTurmaId} disabled={!schoolId}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !schoolId
                    ? "Selecione uma escola primeiro"
                    : turmasQ.isLoading
                      ? "Carregando turmas..."
                      : (turmasQ.data?.length ?? 0) === 0
                        ? "Nenhuma turma cadastrada para esta escola"
                        : "Selecione a turma..."
                }
              />
            </SelectTrigger>
            <SelectContent>
              {turmasQ.data?.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome} · {t.ano} · {t.turno}
                  {t.matricula_atual ? ` · ${t.matricula_atual} matric.` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Planilha (.xlsx, .xls ou .csv)</Label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              setResultado(null);
              setFile(e.target.files?.[0] ?? null);
            }}
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-primary-foreground"
          />
          {file && (
            <p className="text-xs text-muted-foreground">
              Arquivo selecionado: <span className="font-medium text-foreground">{file.name}</span>{" "}
              ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {(() => {
          const faltam: string[] = [];
          if (!simuladoId) faltam.push("simulado");
          if (!schoolId) faltam.push("escola");
          if (!turmaId) faltam.push("turma");
          if (!file) faltam.push("planilha");
          const podeImportar = faltam.length === 0 && !semQuestoes && !importar.isPending;
          return (
            <>
              {faltam.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Para importar, selecione: <span className="font-medium">{faltam.join(", ")}</span>.
                </p>
              )}
              <Button
                onClick={() => importar.mutate()}
                disabled={!podeImportar}
                className="w-full"
                size="lg"
              >
                {importar.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" /> Importar respostas
                  </>
                )}
              </Button>
            </>
          );
        })()}

        {resultado && (
          <div className="space-y-4">
            <div className="rounded-md border border-green-600/30 bg-green-600/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-semibold text-green-700 dark:text-green-400">
                    Importação bem sucedida!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {resultado.respostas_importadas} respostas de {resultado.alunos_processados}{" "}
                    aluno(s) foram importadas para o simulado ({resultado.total_questoes} questões).
                  </p>
                </div>
              </div>
            </div>

            {resultado.linhas_ignoradas?.length > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10">
                <div className="flex items-start gap-3 px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      {resultado.linhas_ignoradas.length} linha(s) da planilha foram ignoradas
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Podem ser alunos transferidos ou que não fizeram a prova. A importação continuou normalmente com os demais.
                    </p>
                  </div>
                </div>
                <div className="max-h-56 overflow-auto border-t border-amber-500/30">
                  <table className="w-full text-xs">
                    <thead className="bg-amber-500/10 text-left uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-1.5">Linha</th>
                        <th className="px-3 py-1.5">Nome (se houver)</th>
                        <th className="px-3 py-1.5">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.linhas_ignoradas.map((l: any, i: number) => (
                        <tr key={i} className="border-t border-amber-500/20">
                          <td className="px-3 py-1.5 font-mono">{l.linha}</td>
                          <td className="px-3 py-1.5">{l.nome || <span className="text-muted-foreground italic">—</span>}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{l.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {resultado.detalhes_alunos?.length > 0 && (
              <div className="rounded-md border">
                <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                  <p className="text-sm font-semibold">Respostas importadas por aluno</p>
                  <span className="text-xs text-muted-foreground">
                    {resultado.detalhes_alunos.length} registro(s)
                  </span>
                </div>
                <div className="overflow-auto">

                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Nº chamada</th>
                        <th className="px-3 py-2">Nome do aluno</th>
                        <th className="px-3 py-2 text-center">Acertos</th>
                        <th className="px-3 py-2 text-center">Erros</th>
                        <th className="px-3 py-2 text-center">Em branco</th>
                        <th className="px-3 py-2 text-center">% acerto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.detalhes_alunos.map((a: any, i: number) => {
                        const total = resultado.total_questoes || 1;
                        const pct = ((a.acertos / total) * 100).toFixed(1);
                        return (
                          <tr key={`${a.numero_chamada}-${i}`} className="border-t">
                            <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-2 font-mono text-xs">{a.numero_chamada}</td>
                            <td className="px-3 py-2">
                              {a.nome ? (
                                a.nome
                              ) : (
                                <span className="text-muted-foreground italic">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center font-semibold text-green-600">
                              {a.acertos}
                            </td>
                            <td className="px-3 py-2 text-center text-destructive">{a.erros}</td>
                            <td className="px-3 py-2 text-center text-muted-foreground">
                              {a.em_branco}
                            </td>
                            <td className="px-3 py-2 text-center">{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="rounded-md border bg-muted/40 p-4">
              <p className="text-sm font-semibold">Próximos passos</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Veja os relatórios consolidados por município, escola e padrão de desempenho.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link to="/relatorios">
                    <BarChart3 className="mr-2 h-4 w-4" /> Ver relatórios
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
