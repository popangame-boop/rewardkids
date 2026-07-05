"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notifications";

export async function getMissions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("missions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function createMission(formData: {
  title: string;
  description?: string;
  category?: string;
  point_reward: number;
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

  const { error } = await supabase.from("missions").insert({
    ...formData,
    created_by: profile.id,
    is_active: true,
  });

  if (error) throw new Error(error.message);

  // Notify all children
  const { data: children } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "child");

  if (children) {
    for (const child of children) {
      await createNotification({
        userId: child.id,
        title: "🎯 Misi Baru Tersedia!",
        content: `Misi baru: "${formData.title}" (+${formData.point_reward} Bintang). Yuk selesaikan!`,
        type: "new_mission",
        link: "/child/missions",
      });
    }
  }

  revalidatePath("/parent/missions");
  revalidatePath("/child/missions");
}

export async function updateMission(
  id: string,
  formData: Partial<{
    title: string;
    description: string;
    category: string;
    point_reward: number;
    icon: string;
    is_active: boolean;
  }>
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("missions")
    .update(formData)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/parent/missions");
  revalidatePath("/child/missions");
}

export async function deleteMission(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("missions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/parent/missions");
}
