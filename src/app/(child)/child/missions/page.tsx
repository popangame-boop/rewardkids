import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChildMissionsClient } from "@/components/ChildMissionsClient";

export default async function ChildMissionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  const [missionsRes, pendingLedgersRes] = await Promise.all([
    supabase.from("missions").select("*").eq("is_active", true).order("category"),
    supabase
      .from("ledgers")
      .select("mission_id")
      .eq("user_id", profile!.id)
      .eq("status", "pending")
      .eq("type", "earn"),
  ]);

  const pendingMissionIds = new Set(
    (pendingLedgersRes.data ?? []).map((l) => l.mission_id).filter(Boolean)
  );

  return (
    <ChildMissionsClient
      missions={missionsRes.data ?? []}
      pendingMissionIds={pendingMissionIds}
      childId={profile!.id}
    />
  );
}
