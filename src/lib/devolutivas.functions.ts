import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUS_VALUES = ["enviada", "em_processo", "finalizada"] as const;

async function getRoles(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: any) => r.role as string);
}

export const listDevolutivas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("devolutivas")
      .select(
        "id, autor_id, school_id, turma_id, titulo, mensagem, status, created_at, updated_at, schools(name), turmas(nome, ano, turno), profiles!devolutivas_autor_id_fkey(full_name)",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((d: any) => ({
      id: d.id,
      autor_id: d.autor_id,
      autor_nome: d.profiles?.full_name ?? null,
      school_id: d.school_id,
      school_name: d.schools?.name ?? null,
      turma_id: d.turma_id,
      turma_label: d.turmas
        ? `${d.turmas.nome} · ${d.turmas.ano} · ${d.turmas.turno}`
        : null,
      titulo: d.titulo,
      mensagem: d.mensagem,
      status: d.status as (typeof STATUS_VALUES)[number],
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));
  });

export const createDevolutiva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        school_id: z.string().uuid(),
        turma_id: z.string().uuid().nullable().optional(),
        titulo: z.string().trim().min(2).max(200),
        mensagem: z.string().trim().min(2).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const roles = await getRoles(context.supabase, context.userId);
    if (!roles.includes("superintendente") && !roles.includes("admin")) {
      throw new Error("Apenas Superintendente pode criar devolutivas.");
    }
    const { data: row, error } = await context.supabase
      .from("devolutivas")
      .insert({
        autor_id: context.userId,
        school_id: data.school_id,
        turma_id: data.turma_id ?? null,
        titulo: data.titulo,
        mensagem: data.mensagem,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const updateDevolutivaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(STATUS_VALUES),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("devolutivas")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteDevolutiva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("devolutivas").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listRespostasDevolutiva = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ devolutiva_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("devolutivas_respostas")
      .select("id, autor_id, mensagem, created_at, profiles!devolutivas_respostas_autor_id_fkey(full_name)")
      .eq("devolutiva_id", data.devolutiva_id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      autor_id: r.autor_id,
      autor_nome: r.profiles?.full_name ?? null,
      mensagem: r.mensagem,
      created_at: r.created_at,
    }));
  });

export const addRespostaDevolutiva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        devolutiva_id: z.string().uuid(),
        mensagem: z.string().trim().min(1).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("devolutivas_respostas")
      .insert({
        devolutiva_id: data.devolutiva_id,
        autor_id: context.userId,
        mensagem: data.mensagem,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });
