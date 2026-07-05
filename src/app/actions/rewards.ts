"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notifications";

export async function getRewards() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rewards")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function createReward(formData: {
  title: string;
  description?: string;
  point_cost: number;
  stock: number;
  image_url?: string | null;
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

  const { error } = await supabase.from("rewards").insert({
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
        title: "🎁 Hadiah Baru Tersedia!",
        content: `Hadiah baru: "${formData.title}" (${formData.point_cost} Poin). Ayo tukarkan poinmu!`,
        type: "new_reward",
        link: "/child/rewards",
      });
    }
  }

  revalidatePath("/parent/rewards");
  revalidatePath("/child/rewards");
}

export async function updateReward(
  id: string,
  formData: Partial<{
    title: string;
    description: string;
    point_cost: number;
    stock: number;
    image_url: string | null;
    is_active: boolean;
  }>
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("rewards")
    .update(formData)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/parent/rewards");
  revalidatePath("/child/rewards");
}

export async function deleteReward(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("rewards").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/parent/rewards");
}
