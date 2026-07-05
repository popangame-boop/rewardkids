"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface CreateNotificationParams {
  userId: string;
  title: string;
  content: string;
  type: string;
  link?: string;
}

export async function createNotification({
  userId,
  title,
  content,
  type,
  link,
}: CreateNotificationParams) {
  const supabase = await createClient();
  
  const { data, error } = await supabase.from("notifications").insert({
    user_id: userId,
    title,
    content,
    type,
    link: link || null,
    is_read: false,
  }).select().single();

  if (error) {
    console.error("Failed to create notification:", error.message);
    return null;
  }
  return data;
}

export async function getNotifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get current user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch notifications:", error.message);
    return [];
  }
  return data;
}

export async function markAsRead(notificationId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) throw new Error(error.message);
  revalidatePath("/child/dashboard");
  revalidatePath("/parent/dashboard");
}

export async function markAllAsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile) return;

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", profile.id);

  if (error) throw new Error(error.message);
  revalidatePath("/child/dashboard");
  revalidatePath("/parent/dashboard");
}
