import { createClient, getCachedProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ParentDashboardClient } from "@/components/ParentDashboardClient";

export default async function ParentDashboardPage() {
  const { user, profile: parent } = await getCachedProfile();
  if (!user || !parent) redirect("/login");

  const supabase = await createClient();

  // Fetch initial stats
  const [childrenRes, pendingRes, missionsRes, rewardsRes, recentLedgerRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("role", "child").eq("parent_id", parent.id),
      supabase.from("ledgers").select("id", { count: "exact" }).eq("status", "pending"),
      supabase.from("missions").select("id", { count: "exact" }).eq("is_active", true),
      supabase.from("rewards").select("id", { count: "exact" }).eq("is_active", true),
      supabase
        .from("ledgers")
        .select("*, profiles!ledgers_user_id_fkey(name)")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const children = childrenRes.data ?? [];
  const pendingCount = pendingRes.data?.length ?? 0;
  const missionsCount = missionsRes.data?.length ?? 0;
  const rewardsCount = rewardsRes.data?.length ?? 0;
  const recentLedgers = recentLedgerRes.data ?? [];

  // Get balances for children
  const childrenWithBalance = await Promise.all(
    children.map(async (child) => {
      const { data: balance } = await supabase.rpc("get_child_balance", {
        p_user_id: child.id,
      });
      return { ...child, balance: balance ?? 0 };
    })
  );

  return (
    <ParentDashboardClient
      initialChildren={childrenWithBalance}
      initialPendingCount={pendingCount}
      initialMissionsCount={missionsCount}
      initialRewardsCount={rewardsCount}
      initialRecentLedgers={recentLedgers as any}
      parentId={parent.id}
      parentName={parent.name}
    />
  );
}
