import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TURNOS = ["manha", "tarde", "noite", "integral"] as const;

export const listTurmas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { schoolId?: string }) =>
    z.object({ schoolId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("turmas")
      .select("id, school_id, nome, ano, turno, matricula_sige, matricula_atual, schools(name, inep, city)")
      .order("ano", { ascending: false })
      .order("nome", { ascending: true });
    if (data.schoolId) q = q.eq("school_id", data.schoolId);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

const turmaSchema = z.object({
  id: z.string().uuid().optional(),
  school_id: z.string().uuid(),
  nome: z.string().trim().min(1).max(50),
  ano: z.string().trim().min(1).max(20),
  turno: z.enum(TURNOS),
  matricula_sige: z.string().trim().max(50).optional().nullable().transform((v) => (v ? v : null)),
  matricula_atual: z
    .union([z.number().int().min(0).max(9999), z.string()])
    .optional()
    .nullable()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : parseInt(String(v), 10);
      return Number.isFinite(n) ? n : null;
    }),
});


export const upsertTurma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => turmaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("turmas")
      .upsert(data, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteTurma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("turmas").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
