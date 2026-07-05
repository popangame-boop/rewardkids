import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChildRewardsClient } from "@/components/ChildRewardsClient";

export default async function ChildRewardsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  const [rewardsRes, balanceRes] = await Promise.all([
    supabase.from("rewards").select("*").eq("is_active", true).order("point_cost"),
    supabase.rpc("get_child_balance", { p_user_id: profile!.id }),
  ]);

  return (
    <ChildRewardsClient
      rewards={rewardsRes.data ?? []}
      balance={balanceRes.data ?? 0}
    />
  );
}
