import { getCachedProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChildMissionsClient } from "@/components/ChildMissionsClient";

export default async function ChildMissionsPage() {
  const { user, profile } = await getCachedProfile();
  if (!user || !profile) redirect("/login");

  return (
    <ChildMissionsClient
      missions={[]}
      pendingMissionIds={new Set()}
      childId={profile.id}
    />
  );
}
