import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChildDashboardClient } from "@/components/ChildDashboardClient";

export default async function ChildDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile) redirect("/login");

  const [balanceRes, activeMissionsRes, recentLedgersRes] = await Promise.all([
    supabase.rpc("get_child_balance", { p_user_id: profile.id }),
    supabase.from("missions").select("*").eq("is_active", true).order("created_at", { ascending: false }),
    supabase
      .from("ledgers")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <ChildDashboardClient
      initialBalance={balanceRes.data ?? 0}
      initialActiveMissions={activeMissionsRes.data ?? []}
      initialRecentLedgers={recentLedgersRes.data ?? []}
      childId={profile.id}
      childName={profile.name}
    />
  );
}
