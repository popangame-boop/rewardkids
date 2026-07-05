import { createClient } from "@/lib/supabase/server";
import { RewardsParentClient } from "@/components/RewardsParentClient";

export default async function RewardsPage() {
  const supabase = await createClient();
  const { data: rewards } = await supabase
    .from("rewards")
    .select("*")
    .order("created_at", { ascending: false });

  return <RewardsParentClient initialRewards={rewards ?? []} />;
}
