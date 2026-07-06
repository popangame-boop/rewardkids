import { getCachedProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChildRewardsClient } from "@/components/ChildRewardsClient";

export default async function ChildRewardsPage() {
  const { user, profile } = await getCachedProfile();
  if (!user || !profile) redirect("/login");

  return (
    <ChildRewardsClient
      rewards={[]}
      balance={0}
      childId={profile.id}
    />
  );
}
