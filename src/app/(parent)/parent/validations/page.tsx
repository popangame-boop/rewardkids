import { createClient } from "@/lib/supabase/server";
import { ValidationsClient } from "@/components/ValidationsClient";

export default async function ValidationsPage() {
  const supabase = await createClient();
  const { data: ledgers } = await supabase
    .from("ledgers")
    .select("*, profiles!ledgers_user_id_fkey(name, avatar_url)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return <ValidationsClient initialLedgers={ledgers ?? []} />;
}
