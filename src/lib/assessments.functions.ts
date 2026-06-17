import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "diagnostic-assessments";

export const listAssessments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("diagnostic_assessments")
      .select("id, offer, subject, grade, exam_pdf_path, answer_sheet_pdf_path, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const getAssessment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("diagnostic_assessments")
      .select("id, offer, subject, grade, exam_pdf_path, answer_sheet_pdf_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Avaliação não encontrada.");
    return row;
  });

export const createAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      offer: z.string().min(1),
      subject: z.string().min(1),
      grade: z.string().min(1),
      exam_pdf_path: z.string().optional().nullable(),
      answer_sheet_pdf_path: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("diagnostic_assessments")
      .insert({
        offer: data.offer,
        subject: data.subject,
        grade: data.grade,
        exam_pdf_path: data.exam_pdf_path ?? null,
        answer_sheet_pdf_path: data.answer_sheet_pdf_path ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const updateAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      offer: z.string().min(1),
      subject: z.string().min(1),
      grade: z.string().min(1),
      exam_pdf_path: z.string().optional().nullable(),
      answer_sheet_pdf_path: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("diagnostic_assessments")
      .update({
        offer: data.offer,
        subject: data.subject,
        grade: data.grade,
        exam_pdf_path: data.exam_pdf_path ?? null,
        answer_sheet_pdf_path: data.answer_sheet_pdf_path ?? null,
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("diagnostic_assessments")
      .select("exam_pdf_path, answer_sheet_pdf_path")
      .eq("id", data.id)
      .maybeSingle();
    const paths = [row?.exam_pdf_path, row?.answer_sheet_pdf_path].filter(
      (p): p is string => !!p,
    );
    if (paths.length > 0) {
      await context.supabase.storage.from(BUCKET).remove(paths);
    }
    const { error } = await context.supabase
      .from("diagnostic_assessments")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getAssessmentFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from(BUCKET)
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw error;
    return { url: signed.signedUrl };
  });
