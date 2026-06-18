import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, Upload, X } from "lucide-react";
import {
  listSupportMaterials,
  createSupportMaterial,
  updateSupportMaterial,
  deleteSupportMaterial,
} from "@/lib/support-materials.functions";
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

const BUCKET = "support-materials";

type Row = {
  id: string;
  offer: string;
  grade: string;
  component: string | null;
  answer_key_pdf_path: string | null;
  commented_test_pdf_path: string | null;
  support_material_url: string | null;
};

export function SupportMaterialsManager() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSupportMaterials);
  const createFn = useServerFn(createSupportMaterial);
  const updateFn = useServerFn(updateSupportMaterial);
  const deleteFn = useServerFn(deleteSupportMaterial);

  const q = useQuery({ queryKey: ["support-materials"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [offer, setOffer] = useState("");
  const [grade, setGrade] = useState("");
  const [component, setComponent] = useState("");
  const [supportUrl, setSupportUrl] = useState("");
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [testFile, setTestFile] = useState<File | null>(null);
  const [keyPath, setKeyPath] = useState<string | null>(null);
  const [testPath, setTestPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setEditing(null);
    setOffer(""); setGrade(""); setComponent(""); setSupportUrl("");
    setKeyFile(null); setTestFile(null);
    setKeyPath(null); setTestPath(null);
  }

  function openNew() { resetForm(); setOpen(true); }
  function openEdit(r: Row) {
    setEditing(r);
    setOffer(r.offer); setGrade(r.grade);
    setComponent(r.component ?? "");
    setSupportUrl(r.support_material_url ?? "");
    setKeyPath(r.answer_key_pdf_path); setTestPath(r.commented_test_pdf_path);
    setKeyFile(null); setTestFile(null);
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
      let finalKey = keyPath;
      let finalTest = testPath;
      if (keyFile) finalKey = await uploadFile(keyFile, "answer-keys");
      if (testFile) finalTest = await uploadFile(testFile, "commented-tests");

      const payload = {
        offer, grade,
        component: component.trim() || null,
        answer_key_pdf_path: finalKey,
        commented_test_pdf_path: finalTest,
        support_material_url: supportUrl.trim() || null,
      };

      if (editing) {
        await updateFn({ data: { id: editing.id, ...payload } });
        toast.success("Material atualizado.");
      } else {
        await createFn({ data: payload });
        toast.success("Material cadastrado.");
      }
      qc.invalidateQueries({ queryKey: ["support-materials"] });
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
      toast.success("Material removido.");
      qc.invalidateQueries({ queryKey: ["support-materials"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Gabarito e Material de Apoio</CardTitle>
          <CardDescription>
            Cadastre Oferta, Série, Gabarito (PDF), Teste Comentado (PDF) e link do Material de Apoio.
          </CardDescription>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Novo
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Oferta</TableHead>
                <TableHead>Série</TableHead>
                <TableHead>Gabarito</TableHead>
                <TableHead>Teste comentado</TableHead>
                <TableHead>Mat. apoio</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    Nenhum material ainda.
                  </TableCell>
                </TableRow>
              )}
              {q.data?.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.offer}</TableCell>
                  <TableCell>{a.grade}</TableCell>
                  <TableCell>{a.answer_key_pdf_path ? "✓" : "—"}</TableCell>
                  <TableCell>{a.commented_test_pdf_path ? "✓" : "—"}</TableCell>
                  <TableCell>{a.support_material_url ? "✓" : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(a as Row)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Remover este material?")) del.mutate(a.id);
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
            <DialogTitle>{editing ? "Editar material" : "Novo material"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleSave}>
            <div className="space-y-1.5">
              <Label>Oferta</Label>
              <Input value={offer} onChange={(e) => setOffer(e.target.value)} required
                placeholder="Ex.: Ensino Médio Regular" />
            </div>
            <div className="space-y-1.5">
              <Label>Série</Label>
              <Input value={grade} onChange={(e) => setGrade(e.target.value)} required
                placeholder="Ex.: 1ª série" />
            </div>

            <FileField
              label="Gabarito (PDF)"
              file={keyFile}
              setFile={setKeyFile}
              existingPath={keyPath}
              onClearExisting={() => setKeyPath(null)}
            />
            <FileField
              label="Teste comentado (PDF)"
              file={testFile}
              setFile={setTestFile}
              existingPath={testPath}
              onClearExisting={() => setTestPath(null)}
            />

            <div className="space-y-1.5">
              <Label>Material de Apoio (link)</Label>
              <Input
                type="url"
                value={supportUrl}
                onChange={(e) => setSupportUrl(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">
                Link disponibilizado pelos professores formadores.
              </p>
            </div>

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
