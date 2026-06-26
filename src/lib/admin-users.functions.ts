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
      .select("id, full_name, email, school_id, cargo, disciplinas, serie, turno, schools(name, inep)")
      .order("full_name", { ascending: true });
    if (error) throw error;

    const ids = (profiles ?? []).map((p: any) => p.id);
    let rolesByUser = new Map<string, string[]>();
    let turmasByUser = new Map<string, string[]>();
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
      const { data: pts } = await context.supabase
        .from("professor_turmas")
        .select("user_id, turma_id")
        .in("user_id", ids);
      for (const r of pts ?? []) {
        const arr = turmasByUser.get(r.user_id) ?? [];
        arr.push(r.turma_id);
        turmasByUser.set(r.user_id, arr);
      }
    }

    return (profiles ?? []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      school_id: p.school_id,
      school_name: p.schools?.name ?? null,
      school_inep: p.schools?.inep ?? null,
      cargo: p.cargo ?? null,
      disciplinas: (p.disciplinas as string[] | null) ?? [],
      serie: p.serie ?? null,
      turno: p.turno ?? null,
      turma_ids: turmasByUser.get(p.id) ?? [],
      roles: rolesByUser.get(p.id) ?? [],
    }));
  });

const ROLES = [
  "admin",
  "professor",
  "professor_responsavel",
  "gestor",
  "aluno",
  "superintendente",
  "professor_escola",
] as const;

const PASSWORD_POLICY_MESSAGE =
  "Senha muito fraca ou conhecida em vazamentos. Use uma senha diferente, com letras maiúsculas, minúsculas, números e símbolos.";

function getPasswordErrorMessage(error: unknown) {
  const err = error as { code?: string; message?: string; name?: string } | null | undefined;
  const text = `${err?.code ?? ""} ${err?.name ?? ""} ${err?.message ?? ""}`.toLowerCase();
  if (
    text.includes("weak_password") ||
    text.includes("weakpassword") ||
    text.includes("weak password") ||
    text.includes("known to be weak") ||
    text.includes("easy to guess") ||
    text.includes("pwned")
  ) {
    return PASSWORD_POLICY_MESSAGE;
  }
  return null;
}

const profileExtrasSchema = z.object({
  cargo: z.string().trim().max(60).nullable().optional(),
  disciplinas: z.array(z.string().trim().max(60)).max(20).nullable().optional(),
  serie: z.string().trim().max(60).nullable().optional(),
  turno: z.string().trim().max(30).nullable().optional(),
  turma_ids: z.array(z.string().uuid()).max(50).nullable().optional(),
});

const createSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(72),
    full_name: z.string().trim().min(2).max(200),
    role: z.enum(ROLES),
    school_id: z.string().uuid().nullable().optional(),
  })
  .merge(profileExtrasSchema);

const SCHOOL_REQUIRED_ROLES = new Set([
  "professor_responsavel",
  "gestor",
  "professor_escola",
  "professor",
]);

export const createManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    if (SCHOOL_REQUIRED_ROLES.has(data.role) && !data.school_id) {
      throw new Error("Este perfil precisa estar vinculado a uma escola.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let created;
    try {
      const response = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          full_name: data.full_name,
          created_by_admin: true,
          school_id: data.school_id ?? null,
        },
      });
      if (response.error) {
        const passwordMessage = getPasswordErrorMessage(response.error);
        if (passwordMessage) return { ok: false, error: passwordMessage };
        throw response.error;
      }
      created = response.data;
    } catch (error) {
      const passwordMessage = getPasswordErrorMessage(error);
      if (passwordMessage) return { ok: false, error: passwordMessage };
      throw error;
    }

    const userId = created.user!.id;

    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        school_id: data.school_id ?? null,
        cargo: data.cargo ?? null,
        disciplinas: data.disciplinas ?? null,
        serie: data.serie ?? null,
        turno: data.turno ?? null,
      })
      .eq("id", userId);

    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.role });

    if (data.role === "professor_escola" && data.turma_ids && data.turma_ids.length) {
      await supabaseAdmin
        .from("professor_turmas")
        .insert(data.turma_ids.map((tid) => ({ user_id: userId, turma_id: tid })));
    }

    return { ok: true, id: userId };
  });

const updateSchema = z
  .object({
    user_id: z.string().uuid(),
    full_name: z.string().trim().min(2).max(200).optional(),
    role: z.enum(ROLES).optional(),
    school_id: z.string().uuid().nullable().optional(),
    new_password: z.string().min(8).max(72).optional().nullable(),
  })
  .merge(profileExtrasSchema);

export const updateManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: any = {};
    if (data.full_name !== undefined) patch.full_name = data.full_name;
    if (data.school_id !== undefined) patch.school_id = data.school_id;
    if (data.cargo !== undefined) patch.cargo = data.cargo;
    if (data.disciplinas !== undefined) patch.disciplinas = data.disciplinas;
    if (data.serie !== undefined) patch.serie = data.serie;
    if (data.turno !== undefined) patch.turno = data.turno;
    if (Object.keys(patch).length) {
      await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
    }

    if (data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
      await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    }

    if (data.turma_ids !== undefined && data.turma_ids !== null) {
      await supabaseAdmin.from("professor_turmas").delete().eq("user_id", data.user_id);
      if (data.turma_ids.length) {
        await supabaseAdmin
          .from("professor_turmas")
          .insert(data.turma_ids.map((tid) => ({ user_id: data.user_id, turma_id: tid })));
      }
    }

    if (data.new_password) {
      try {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
          password: data.new_password,
        });
        if (error) {
          const passwordMessage = getPasswordErrorMessage(error);
          if (passwordMessage) return { ok: false, error: passwordMessage };
          throw error;
        }
      } catch (error) {
        const passwordMessage = getPasswordErrorMessage(error);
        if (passwordMessage) return { ok: false, error: passwordMessage };
        throw error;
      }
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
