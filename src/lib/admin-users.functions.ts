import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: profiles, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, email, school_id, schools(name, inep)")
      .order("full_name", { ascending: true });
    if (error) throw error;

    const ids = (profiles ?? []).map((p: any) => p.id);
    let rolesByUser = new Map<string, string[]>();
    if (ids.length) {
      const { data: roles } = await context.supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      for (const r of roles ?? []) {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      }
    }

    return (profiles ?? []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      school_id: p.school_id,
      school_name: p.schools?.name ?? null,
      school_inep: p.schools?.inep ?? null,
      roles: rolesByUser.get(p.id) ?? [],
    }));
  });

const ROLES = ["admin", "professor", "professor_responsavel", "gestor", "aluno"] as const;

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  full_name: z.string().trim().min(2).max(200),
  role: z.enum(ROLES),
  school_id: z.string().uuid().nullable().optional(),
});

export const createManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    if ((data.role === "professor_responsavel" || data.role === "gestor") && !data.school_id) {
      throw new Error("Professor responsável e Gestor precisam de uma escola.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        created_by_admin: true,
        school_id: data.school_id ?? null,
      },
    });
    if (error) throw error;
    const userId = created.user!.id;

    // Garantir perfil (trigger já insere, mas garantimos os campos)
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.full_name, school_id: data.school_id ?? null })
      .eq("id", userId);

    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.role });

    return { id: userId };
  });

const updateSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(200).optional(),
  role: z.enum(ROLES).optional(),
  school_id: z.string().uuid().nullable().optional(),
  new_password: z.string().min(8).max(72).optional().nullable(),
});

export const updateManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.full_name !== undefined || data.school_id !== undefined) {
      const patch: any = {};
      if (data.full_name !== undefined) patch.full_name = data.full_name;
      if (data.school_id !== undefined) patch.school_id = data.school_id;
      await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
    }

    if (data.role) {
      // Substitui papéis pelo único papel selecionado (mantemos 1 papel por usuário no admin)
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
      await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    }

    if (data.new_password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
        password: data.new_password,
      });
      if (error) throw error;
    }

    return { ok: true };
  });

export const deleteManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) =>
    z.object({ user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Você não pode excluir a própria conta.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw error;
    return { ok: true };
  });
