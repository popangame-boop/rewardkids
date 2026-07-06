import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChildHistoryClient } from "@/components/ChildHistoryClient";

export default async function ChildHistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  const { data: ledgers } = await supabase
    .from("ledgers")
    .select("*")
    .eq("user_id", profile!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="px-4 pt-6 pb-2 space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-black text-fun-dark-purple">Riwayat Aktivitas 📋</h1>
        <p className="text-fun-text/60 text-sm mt-1 font-semibold">Semua catatan poin-mu</p>
      </div>

      {!ledgers || ledgers.length === 0 ? (
        <div className="text-center py-20 bg-white border border-border rounded-[2.2rem] shadow-sm">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-fun-dark-purple font-black text-xl">Belum ada aktivitas</p>
          <p className="text-fun-text/40 text-sm mt-1 font-semibold">Selesaikan misi pertamamu!</p>
        </div>
      ) : (
        <ChildHistoryClient initialLedgers={ledgers} childId={profile!.id} />
      )}
    </div>
  );
}
