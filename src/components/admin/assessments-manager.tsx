import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, Upload, X } from "lucide-react";
import {
  listAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
} from "@/lib/assessments.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const BUCKET = "diagnostic-assessments";

type Row = {
  id: string;
  offer: string;
  subject: string;
  grade: string;
  exam_pdf_path: string | null;
  answer_sheet_pdf_path: string | null;
};

export function AssessmentsManager() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAssessments);
  const createFn = useServerFn(createAssessment);
  const updateFn = useServerFn(updateAssessment);
  const deleteFn = useServerFn(deleteAssessment);

  const q = useQuery({ queryKey: ["assessments"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [offer, setOffer] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [examFile, setExamFile] = useState<File | null>(null);
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [examPath, setExamPath] = useState<string | null>(null);
  const [sheetPath, setSheetPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setEditing(null);
    setOffer(""); setSubject(""); setGrade("");
    setExamFile(null); setSheetFile(null);
    setExamPath(null); setSheetPath(null);
  }

  function openNew() { resetForm(); setOpen(true); }
  function openEdit(r: Row) {
    setEditing(r);
    setOffer(r.offer); setSubject(r.subject); setGrade(r.grade);
    setExamPath(r.exam_pdf_path); setSheetPath(r.answer_sheet_pdf_path);
    setExamFile(null); setSheetFile(null);
    setOpen(true);
  }

  async function uploadFile(file: File, prefix: string): Promise<string> {
    const ext = file.name.split(".").pop() ?? "pdf";
    const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "application/pdf",
    });
    if (error) throw error;
    return path;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let finalExam = examPath;
      let finalSheet = sheetPath;
      if (examFile) finalExam = await uploadFile(examFile, "exams");
      if (sheetFile) finalSheet = await uploadFile(sheetFile, "sheets");

      if (editing) {
        await updateFn({ data: {
          id: editing.id, offer, subject, grade,
          exam_pdf_path: finalExam, answer_sheet_pdf_path: finalSheet,
        }});
        toast.success("Avaliação atualizada.");
      } else {
        await createFn({ data: {
          offer, subject, grade,
          exam_pdf_path: finalExam, answer_sheet_pdf_path: finalSheet,
        }});
        toast.success("Avaliação criada.");
      }
      qc.invalidateQueries({ queryKey: ["assessments"] });
      setOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Avaliação removida.");
      qc.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Avaliações Diagnósticas</CardTitle>
          <CardDescription>
            Cadastre as avaliações com Oferta, Componente, Série e os PDFs.
          </CardDescription>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Nova
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Oferta</TableHead>
                <TableHead>Componente</TableHead>
                <TableHead>Série</TableHead>
                <TableHead>Provas</TableHead>
                <TableHead>Cartões</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    Nenhuma avaliação ainda.
                  </TableCell>
                </TableRow>
              )}
              {q.data?.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.offer}</TableCell>
                  <TableCell>{a.subject}</TableCell>
                  <TableCell>{a.grade}</TableCell>
                  <TableCell>{a.exam_pdf_path ? "✓" : "—"}</TableCell>
                  <TableCell>{a.answer_sheet_pdf_path ? "✓" : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(a as Row)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Remover esta avaliação?")) del.mutate(a.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar avaliação" : "Nova avaliação"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleSave}>
            <div className="space-y-1.5">
              <Label>Oferta</Label>
              <Input value={offer} onChange={(e) => setOffer(e.target.value)} required
                placeholder="Ex.: Ensino Médio Regular" />
            </div>
            <div className="space-y-1.5">
              <Label>Componente Curricular / Disciplina</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} required
                placeholder="Ex.: Língua Portuguesa" />
            </div>
            <div className="space-y-1.5">
              <Label>Série</Label>
              <Input value={grade} onChange={(e) => setGrade(e.target.value)} required
                placeholder="Ex.: 1ª série" />
            </div>

            <FileField
              label="Caderno de Provas (PDF)"
              file={examFile}
              setFile={setExamFile}
              existingPath={examPath}
              onClearExisting={() => setExamPath(null)}
            />
            <FileField
              label="Cartões de Resposta (PDF)"
              file={sheetFile}
              setFile={setSheetFile}
              existingPath={sheetPath}
              onClearExisting={() => setSheetPath(null)}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function FileField({
  label, file, setFile, existingPath, onClearExisting,
}: {
  label: string;
  file: File | null;
  setFile: (f: File | null) => void;
  existingPath: string | null;
  onClearExisting: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {existingPath && !file && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-xs">
          <span className="truncate">Arquivo atual: {existingPath.split("/").pop()}</span>
          <Button type="button" variant="ghost" size="icon" onClick={onClearExisting}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file && (
          <Button type="button" size="icon" variant="ghost" onClick={() => setFile(null)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {file && (
        <p className="text-xs text-muted-foreground">
          <Upload className="mr-1 inline h-3 w-3" /> {file.name}
        </p>
      )}
    </div>
  );
}
