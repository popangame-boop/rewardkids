import { getCachedProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PunishmentsClient } from "@/components/PunishmentsClient";

export default async function PunishmentsPage() {
  const { user, profile: parent } = await getCachedProfile();
  if (!user || !parent) redirect("/login");

  return (
    <PunishmentsClient
      parentId={parent.id}
      initialChildren={[]}
      initialRecentPunishments={[]}
      initialPredefinedPunishments={[]}
    />
  );
}
