import { getCachedProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChildDashboardClient } from "@/components/ChildDashboardClient";

export default async function ChildDashboardPage() {
  const { user, profile } = await getCachedProfile();
  if (!user || !profile) redirect("/login");

  return (
    <ChildDashboardClient
      initialBalance={0}
      initialActiveMissions={[]}
      initialRecentLedgers={[]}
      childId={profile.id}
      childName={profile.name}
    />
  );
}
