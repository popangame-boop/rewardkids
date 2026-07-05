import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PunishmentsClient } from "@/components/PunishmentsClient";

export default async function PunishmentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: parent } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  const { data: children } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("role", "child")
    .eq("parent_id", parent!.id);

  const { data: recentPunishments } = await supabase
    .from("ledgers")
    .select("*, profiles!ledgers_user_id_fkey(name)")
    .eq("type", "punish")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: predefinedPunishments } = await supabase
    .from("punishments")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <PunishmentsClient
      children={children ?? []}
      recentPunishments={recentPunishments ?? []}
      predefinedPunishments={predefinedPunishments ?? []}
    />
  );
}
