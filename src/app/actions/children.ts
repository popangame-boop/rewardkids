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
