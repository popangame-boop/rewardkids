import { getCachedProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ParentDashboardClient } from "@/components/ParentDashboardClient";

export default async function ParentDashboardPage() {
  const { user, profile: parent } = await getCachedProfile();
  if (!user || !parent) redirect("/login");

  return (
    <ParentDashboardClient
      initialChildren={[]}
      initialPendingCount={0}
      initialMissionsCount={0}
      initialRewardsCount={0}
      initialRecentLedgers={[]}
      parentId={parent.id}
      parentName={parent.name}
    />
  );
}
