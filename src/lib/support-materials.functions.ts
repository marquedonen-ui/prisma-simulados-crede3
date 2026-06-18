import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "support-materials";

export const listSupportMaterials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("support_materials")
      .select(
        "id, offer, grade, component, answer_key_pdf_path, commented_test_pdf_path, support_material_url, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createSupportMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        offer: z.string().min(1),
        grade: z.string().min(1),
        component: z.string().optional().nullable(),
        answer_key_pdf_path: z.string().optional().nullable(),
        commented_test_pdf_path: z.string().optional().nullable(),
        support_material_url: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("support_materials")
      .insert({
        offer: data.offer,
        grade: data.grade,
        component: data.component ?? null,
        answer_key_pdf_path: data.answer_key_pdf_path ?? null,
        commented_test_pdf_path: data.commented_test_pdf_path ?? null,
        support_material_url: data.support_material_url ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const updateSupportMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        offer: z.string().min(1),
        grade: z.string().min(1),
        answer_key_pdf_path: z.string().optional().nullable(),
        commented_test_pdf_path: z.string().optional().nullable(),
        support_material_url: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("support_materials")
      .update({
        offer: data.offer,
        grade: data.grade,
        answer_key_pdf_path: data.answer_key_pdf_path ?? null,
        commented_test_pdf_path: data.commented_test_pdf_path ?? null,
        support_material_url: data.support_material_url ?? null,
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteSupportMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("support_materials")
      .select("answer_key_pdf_path, commented_test_pdf_path")
      .eq("id", data.id)
      .maybeSingle();
    const paths = [row?.answer_key_pdf_path, row?.commented_test_pdf_path].filter(
      (p): p is string => !!p,
    );
    if (paths.length > 0) {
      await context.supabase.storage.from(BUCKET).remove(paths);
    }
    const { error } = await context.supabase
      .from("support_materials")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getSupportFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from(BUCKET)
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw error;
    return { url: signed.signedUrl };
  });
