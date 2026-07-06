import { getCachedProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChildrenClient } from "@/components/ChildrenClient";

export default async function ChildrenPage() {
  const { user, profile: parent } = await getCachedProfile();
  if (!user || !parent) redirect("/login");

  return <ChildrenClient initialChildren={[]} parentId={parent.id} />;
}
