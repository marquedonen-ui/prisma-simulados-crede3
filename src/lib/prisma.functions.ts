import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw error;
    const roles = (data ?? []).map((r) => r.role);
    return { roles, isAdmin: roles.includes("admin"), userId: context.userId };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: profile }, { data: rolesData }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("full_name, email, school_id, cargo, disciplinas, serie, turno, schools(name, inep)")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    ]);
    const roles = (rolesData ?? []).map((r) => r.role);
    return {
      fullName: profile?.full_name ?? null,
      email: profile?.email ?? (context.claims?.email as string | undefined) ?? null,
      roles,
      schoolId: profile?.school_id ?? null,
      schoolName: (profile as any)?.schools?.name ?? null,
      schoolInep: (profile as any)?.schools?.inep ?? null,
      cargo: (profile as any)?.cargo ?? null,
      disciplinas: ((profile as any)?.disciplinas as string[] | null) ?? null,
      serie: (profile as any)?.serie ?? null,
      turno: (profile as any)?.turno ?? null,
    };
  });

export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if (countErr) throw countErr;
    if ((count ?? 0) > 0) {
      throw new Error("Já existe um administrador cadastrado.");
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw error;
    return { ok: true };
  });

export const listSchools = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("schools")
      .select("id, name, inep, city, created_at")
      .order("name");
    if (error) throw error;
    return data ?? [];
  });

export const createSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(2),
        inep: z.string().regex(/^\d{8}$/, "INEP deve ter 8 dígitos"),
        city: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("schools")
      .insert({ name: data.name, inep: data.inep, city: data.city ?? null })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const updateSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(2),
        inep: z.string().regex(/^\d{8}$/, "INEP deve ter 8 dígitos"),
        city: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("schools")
      .update({ name: data.name, inep: data.inep, city: data.city ?? null })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("schools").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const generateCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ schoolId: z.string().uuid(), quantity: z.number().int().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("generate_student_codes", {
      _school_id: data.schoolId,
      _quantity: data.quantity,
    });
    if (error) throw error;
    return rows ?? [];
  });

export const listSchoolCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ schoolId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("student_codes")
      .select("id, code, student_name, is_active, last_used_at, created_at")
      .eq("school_id", data.schoolId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const validateCode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: z.string().min(4) }).parse(d))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase.rpc("validate_student_code", {
      _code: data.code.trim().toUpperCase(),
    });
    if (error) throw error;
    const row = (rows ?? [])[0];
    if (!row) throw new Error("Código inválido ou inativo.");
    return row;
  });
