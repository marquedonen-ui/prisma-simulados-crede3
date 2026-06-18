import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Upload, Download, FileSpreadsheet, Loader2 } from "lucide-react";
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
          `Não foi possível ler o arquivo${ehXls ? " .xls" : ""}. Tente salvar como .xlsx e enviar novamente.`,
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
          .replace(/\s+/g, "")
          .toUpperCase();

      const matKeys = new Set(["MATRICULA", "MATR", "INSCRICAO", "INSC", "ID"]);
      const isQKey = (k: string) => /^(?:Q|QUESTAO)?(\d{1,3})$/.test(k);

      // Localiza a linha de cabeçalho (a primeira que contém uma coluna de matrícula).
      let headerIdx = -1;
      for (let i = 0; i < Math.min(matrix.length, 30); i++) {
        const cells = matrix[i].map(norm);
        if (cells.some((c) => matKeys.has(c)) && cells.some(isQKey)) {
          headerIdx = i;
          break;
        }
      }
      // Fallback: usa a primeira linha como cabeçalho se nenhuma combinação foi achada.
      if (headerIdx === -1) headerIdx = 0;

      const headers = matrix[headerIdx].map(norm);
      const matCol = headers.findIndex((h) => matKeys.has(h));

      const linhas: Array<{ matricula: string; respostas: Record<string, string> }> = [];
      for (let r = headerIdx + 1; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row || row.length === 0) continue;
        const matricula =
          matCol >= 0 ? String(row[matCol] ?? "").trim() : "";
        if (!matricula) continue;
        const respostas: Record<string, string> = {};
        for (let c = 0; c < headers.length; c++) {
          const h = headers[c];
          const m = h.match(/^(?:Q|QUESTAO)?(\d{1,3})$/);
          if (!m) continue;
          const num = parseInt(m[1], 10);
          if (num > 0) {
            respostas[`Q${num}`] = String(row[c] ?? "").trim().toUpperCase();
          }
        }
        linhas.push({ matricula, respostas });
      }

      if (linhas.length === 0)
        throw new Error(
          "Nenhuma linha válida. Verifique se há uma coluna 'matricula' e colunas Q1, Q2, ...",
        );


      return importFn({ data: { simuladoId, schoolId, linhas } });
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
    const headers = ["matricula", "nome", "turma"];
    for (let i = 1; i <= numQuestoes; i++) headers.push(`Q${i}`);

    const exemplo = ["12345", "Maria da Silva", "9º A"];
    for (let i = 1; i <= numQuestoes; i++) exemplo.push("A");

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, exemplo]);
    XLSX.utils.book_append_sheet(wb, ws, "cartao-resposta");
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
          <Label>Planilha (.xlsx ou .csv)</Label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-primary-foreground"
          />
        </div>

        <Button
          onClick={() => importar.mutate()}
          disabled={!file || !simuladoId || !schoolId || !turmaId || importar.isPending}
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
          <div className="rounded-md border bg-muted/40 p-4 text-sm">
            <p className="font-semibold">Resumo da importação</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>Respostas importadas: {resultado.respostas_importadas}</li>
              <li>Alunos processados: {resultado.alunos_processados}</li>
              <li>Total de questões do simulado: {resultado.total_questoes}</li>
              {resultado.matriculas_nao_encontradas.length > 0 && (
                <li className="text-destructive">
                  Matrículas não encontradas:{" "}
                  <span className="font-mono">
                    {resultado.matriculas_nao_encontradas.join(", ")}
                  </span>
                </li>
              )}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Vá em <strong>Correção de Simulados</strong> no menu lateral e clique em
              "Corrigir Automaticamente" para gerar os resultados.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
