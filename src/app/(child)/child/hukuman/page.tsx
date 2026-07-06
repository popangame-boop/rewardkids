import { getCachedProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChildHukumanClient } from "@/components/ChildHukumanClient";

export default async function ChildHukumanPage() {
  const { user, profile } = await getCachedProfile();
  if (!user || !profile) redirect("/login");

  return (
    <ChildHukumanClient
      punishments={[]}
      ledgers={[]}
      childId={profile.id}
    />
  );
}
