"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getChildren() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: parent } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "child")
    .eq("parent_id", parent!.id)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function createChildAccount(formData: {
  name: string;
  pin: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: parent } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  if (parent?.role !== "parent") throw new Error("Unauthorized");

  // Deterministic email and password for the child
  const cleanName = formData.name.replace(/\s+/g, "").toLowerCase();
  const email = `${cleanName}.${parent.id}@kidsreward.internal`;
  const password = `${formData.pin}_${parent.id}`;

  const adminSupabase = await createAdminClient();

  // Create auth user for child using Admin API (bypasses email validation and rate limits)
  const { data: childAuth, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email
    user_metadata: { name: formData.name, role: "child" },
  });

  if (authError) throw new Error(authError.message);

  if (childAuth.user) {
    const { error: profileError } = await supabase.from("profiles").insert({
      auth_user_id: childAuth.user.id,
      role: "child",
      name: formData.name,
      pin: formData.pin,
      parent_id: parent.id,
    });

    if (profileError) throw new Error(profileError.message);
  }

  revalidatePath("/parent/children");
}

export async function getChildBalance(childId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_child_balance", {
    p_user_id: childId,
  });
  if (error) throw new Error(error.message);
  return data as number;
}

export async function resetDemoData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: parent } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  if (!parent || parent.role !== "parent") {
    throw new Error("Unauthorized: Only parents can reset data");
  }

  // Get children profiles
  const { data: children } = await supabase
    .from("profiles")
    .select("id")
    .eq("parent_id", parent.id);

  const childIds = children?.map((c) => c.id) || [];

  // 1. Delete ledgers (history)
  if (childIds.length > 0) {
    const { error: ledgerError } = await supabase
      .from("ledgers")
      .delete()
      .in("user_id", childIds);
    if (ledgerError) throw new Error(ledgerError.message);
  }

  // Also clean up any ledgers reviewed by this parent (just in case)
  const { error: ledgerReviewError } = await supabase
    .from("ledgers")
    .delete()
    .eq("reviewed_by", parent.id);
  if (ledgerReviewError) throw new Error(ledgerReviewError.message);

  // 2. Delete notifications
  if (childIds.length > 0) {
    const { error: notifError } = await supabase
      .from("notifications")
      .delete()
      .in("user_id", childIds);
    if (notifError) throw new Error(notifError.message);
  }
  const { error: parentNotifError } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", parent.id);
  if (parentNotifError) throw new Error(parentNotifError.message);

  // 3. Delete rewards
  const { error: rewardError } = await supabase
    .from("rewards")
    .delete()
    .eq("created_by", parent.id);
  if (rewardError) throw new Error(rewardError.message);

  // 4. Delete missions
  const { error: missionError } = await supabase
    .from("missions")
    .delete()
    .eq("created_by", parent.id);
  if (missionError) throw new Error(missionError.message);

  // 5. Delete punishments
  const { error: punishmentError } = await supabase
    .from("punishments")
    .delete()
    .eq("created_by", parent.id);
  if (punishmentError) throw new Error(punishmentError.message);

  // Revalidate paths
  revalidatePath("/parent/dashboard");
  revalidatePath("/parent/children");
  revalidatePath("/parent/missions");
  revalidatePath("/parent/rewards");
  revalidatePath("/parent/validations");
  revalidatePath("/parent/punishments");
  revalidatePath("/child/dashboard");
  revalidatePath("/child/missions");
  revalidatePath("/child/rewards");
  revalidatePath("/child/history");
}

