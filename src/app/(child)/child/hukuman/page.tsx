import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChildHukumanClient } from "@/components/ChildHukumanClient";

export default async function ChildHukumanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile) redirect("/login");

  const [punishmentsRes, ledgersRes] = await Promise.all([
    supabase.from("punishments").select("*").eq("is_active", true).order("point_penalty"),
    supabase.from("ledgers")
      .select("*")
      .eq("user_id", profile.id)
      .eq("type", "punish")
      .eq("status", "approved")
  ]);

  return (
    <ChildHukumanClient
      punishments={punishmentsRes.data ?? []}
      ledgers={ledgersRes.data ?? []}
      childId={profile.id}
    />
  );
}
