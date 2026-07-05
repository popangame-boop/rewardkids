"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getPunishments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("punishments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function createPunishment(formData: {
  title: string;
  description?: string;
  point_penalty: number;
  icon: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  if (profile?.role !== "parent") throw new Error("Unauthorized");

  const { error } = await supabase.from("punishments").insert({
    ...formData,
    created_by: profile.id,
    is_active: true,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/parent/punishments");
}

export async function updatePunishment(
  id: string,
  formData: Partial<{
    title: string;
    description: string;
    point_penalty: number;
    icon: string;
    is_active: boolean;
  }>
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("punishments")
    .update(formData)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/parent/punishments");
}

export async function deletePunishment(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("punishments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/parent/punishments");
}
