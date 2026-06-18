import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, BarChart3, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { importarRespostas } from "@/lib/offline.functions";
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

  const turmasQ = useQuery({
    queryKey: ["turmas", schoolId],
    queryFn: () => listTurmasFn({ data: { schoolId } }),
    enabled: !!schoolId,
  });

  const importar = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione uma planilha.");
      if (!simuladoId) throw new Error("Selecione o simulado.");
      if (!schoolId) throw new Error("Selecione a escola.");
      if (!turmaId) throw new Error("Selecione a turma em que a avaliação foi aplicada.");

      // Detecta extensão para escolher o método de leitura mais compatível.
      const nome = file.name.toLowerCase();
      const ehXls = nome.endsWith(".xls");
      const ehCsv = nome.endsWith(".csv");

      let wb: XLSX.WorkBook;
      try {
        if (ehCsv) {
          const txt = await file.text();
          wb = XLSX.read(txt, { type: "string", raw: false });
        } else {
          // .xls (BIFF) e .xlsx — usa Uint8Array, compatível com ambos.
          const buf = new Uint8Array(await file.arrayBuffer());
          wb = XLSX.read(buf, { type: "array", cellDates: false, raw: false });
        }
      } catch (err) {
        throw new Error(
          `Não foi possível ler o arquivo${ehXls ? " .xls" : ""}. Verifique se é uma planilha válida no modelo Reports.`,
        );
      }

      if (!wb.SheetNames.length) throw new Error("Planilha sem abas.");
      const sheet = wb.Sheets[wb.SheetNames[0]];

      // Lê tudo como matriz (linhas x colunas) para suportar arquivos .xls
      // exportados de sistemas (SIGE etc.) que costumam ter linhas de título,
      // linhas em branco ou cabeçalhos mesclados antes do cabeçalho real.
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

      const matKeys = new Set([
        "MATRICULA",
        "MATR",
        "INSCRICAO",
        "INSC",
        "ID",
        "NUMDALISTA",
        "NUMERODALISTA",
        "NDALISTA",
        "NLISTA",
        "CHAMADA",
      ]);
      // Reconhece tanto "Q1", "QUESTAO1" como o padrão SIGE "Q 1 Options".
      const qOptionsRe = /^Q(\d{1,3})(?:OPTIONS|OPTION|OPCOES|OPCAO|RESPOSTA|ALTERNATIVA)$/;
      const qSimpleRe = /^(?:Q|QUESTAO)(\d{1,3})$/;
      const isQKey = (k: string) => qOptionsRe.test(k) || qSimpleRe.test(k);

      // Localiza a linha de cabeçalho (primeira que contém matrícula/lista + colunas Q).
      let headerIdx = -1;
      for (let i = 0; i < Math.min(matrix.length, 30); i++) {
        const cells = matrix[i].map(norm);
        if (cells.some((c) => matKeys.has(c)) && cells.some(isQKey)) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx === -1) {
        headerIdx = matrix.findIndex((row) => row.map(norm).some(isQKey));
      }
      if (headerIdx === -1) headerIdx = 0;

      const headers = matrix[headerIdx].map(norm);
      const matCol = headers.findIndex((h) => matKeys.has(h));
      const chamadaFallbackCol = 2;

      const linhas: Array<{ matricula: string; respostas: Record<string, string> }> = [];
      for (let r = headerIdx + 1; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row || row.length === 0) continue;
        const matricula = String(row[matCol >= 0 ? matCol : chamadaFallbackCol] ?? "").trim();
        if (!matricula) continue;
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
        linhas.push({ matricula, respostas });
      }

      if (linhas.length === 0)
        throw new Error(
          "Nenhuma linha válida. Verifique se há uma coluna 'Núm. da lista' (matrícula) e colunas Q N Options.",
        );



      return importFn({ data: { simuladoId, schoolId, turmaId, linhas } });
    },
    onSuccess: (r) => {
      setResultado(r);
      const naoEnc = r.matriculas_nao_encontradas.length;
      if (naoEnc > 0) {
        toast.warning(
          `Importação parcial: ${r.respostas_importadas} respostas. ${naoEnc} matrícula(s) não encontrada(s).`,
        );
      } else {
        toast.success(
          `${r.respostas_importadas} respostas de ${r.alunos_processados} aluno(s) importadas!`,
        );
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha na importação"),
  });

  function baixarModelo() {
    const numQuestoes = 20;
    // Estrutura compatível com exportação do leitor de cartões (SIGE/Reports):
    // A=Exame, B=Conjunto de exames, C=Núm. da lista, D=Nome, E=Total de marcas,
    // F=Nota, G=Classificação, H=Respostas corretas, I=Respostas incorretas,
    // J=Not attempted, K=Assunto 1, e a partir de L: trios "Q N Options", "Q N Key", "Q N Marks".
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
      "Maria da Silva",
      18,
      9.0,
      1,
      18,
      2,
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
          Faça upload da planilha preenchida pela escola. O sistema valida as matrículas e
          importa as respostas para o simulado escolhido.
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
                  {t.matricula_sige ? ` · SIGE ${t.matricula_sige}` : ""}
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
        </div>

        <Button
          onClick={() => importar.mutate()}
          disabled={importar.isPending}
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
                    {resultado.respostas_importadas} respostas de {resultado.alunos_processados} aluno(s) foram importadas para o simulado ({resultado.total_questoes} questões).
                  </p>
                </div>
              </div>
            </div>

            {resultado.matriculas_nao_encontradas?.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
                <p className="font-medium text-destructive">
                  {resultado.matriculas_nao_encontradas.length} matrícula(s) não encontrada(s):
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {resultado.matriculas_nao_encontradas.join(", ")}
                </p>
              </div>
            )}

            {resultado.detalhes_alunos?.length > 0 && (
              <div className="rounded-md border">
                <div className="border-b bg-muted/40 px-3 py-2">
                  <p className="text-sm font-semibold">Respostas importadas por aluno</p>
                </div>
                <div className="max-h-96 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Matrícula</th>
                        <th className="px-3 py-2">Aluno</th>
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
                          <tr key={`${a.matricula}-${i}`} className="border-t">
                            <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-2 font-mono text-xs">{a.matricula}</td>
                            <td className="px-3 py-2">{a.nome}</td>
                            <td className="px-3 py-2 text-center font-semibold text-green-600">{a.acertos}</td>
                            <td className="px-3 py-2 text-center text-destructive">{a.erros}</td>
                            <td className="px-3 py-2 text-center text-muted-foreground">{a.em_branco}</td>
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
                Execute a correção automática para consolidar os resultados e, em seguida, acesse os relatórios.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/correcao">
                    <CheckSquare className="mr-2 h-4 w-4" /> Corrigir simulados
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/relatorios">
                    <BarChart3 className="mr-2 h-4 w-4" /> Relatórios por Acerto e Padrões de Desempenho
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
