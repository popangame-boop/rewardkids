import { createClient, getCachedProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  CheckCircle,
  Star,
  Clock,
  TrendingUp,
  Target,
  Gift,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { ResetDataButton } from "@/components/ResetDataButton";

export default async function ParentDashboardPage() {
  const { user, profile: parent } = await getCachedProfile();
  if (!user || !parent) redirect("/login");

  const supabase = await createClient();

  // Fetch stats
  const [childrenRes, pendingRes, missionsRes, rewardsRes, recentLedgerRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("role", "child").eq("parent_id", parent!.id),
      supabase.from("ledgers").select("id", { count: "exact" }).eq("status", "pending"),
      supabase.from("missions").select("id", { count: "exact" }).eq("is_active", true),
      supabase.from("rewards").select("id", { count: "exact" }).eq("is_active", true),
      supabase
        .from("ledgers")
        .select("*, profiles!ledgers_user_id_fkey(name)")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const children = childrenRes.data ?? [];
  const pendingCount = pendingRes.data?.length ?? 0;
  const missionsCount = missionsRes.data?.length ?? 0;
  const rewardsCount = rewardsRes.data?.length ?? 0;
  const recentLedgers = recentLedgerRes.data ?? [];

  // Get balances for children
  const childrenWithBalance = await Promise.all(
    children.map(async (child) => {
      const { data: balance } = await supabase.rpc("get_child_balance", {
        p_user_id: child.id,
      });
      return { ...child, balance: balance ?? 0 };
    })
  );

  const stats = [
    {
      title: "Total Anak",
      value: children.length,
      icon: Users,
      color: "from-blue-500 to-indigo-600",
      bg: "bg-blue-500/10",
      href: "/parent/children",
    },
    {
      title: "Menunggu Validasi",
      value: pendingCount,
      icon: Clock,
      color: "from-amber-500 to-orange-600",
      bg: "bg-amber-500/10",
      href: "/parent/validations",
      urgent: pendingCount > 0,
    },
    {
      title: "Misi Aktif",
      value: missionsCount,
      icon: Target,
      color: "from-green-500 to-emerald-600",
      bg: "bg-green-500/10",
      href: "/parent/missions",
    },
    {
      title: "Hadiah Tersedia",
      value: rewardsCount,
      icon: Gift,
      color: "from-purple-500 to-violet-600",
      bg: "bg-purple-500/10",
      href: "/parent/rewards",
    },
  ];

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    approved: "bg-green-500/20 text-green-300 border-green-500/30",
    rejected: "bg-red-500/20 text-red-300 border-red-500/30",
  };

  const typeLabels: Record<string, string> = {
    earn: "✅ Selesai Misi",
    spend: "🎁 Tukar Hadiah",
    punish: "⚡ Punishment",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-fun-dark-purple">
            Halo, {parent?.name?.split(" ")[0]}! 👋
          </h1>
          <p className="text-fun-text/60 text-sm mt-1 font-semibold">
            Pantau perkembangan anak-anakmu hari ini
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-fun-purple" />
          <Star className="w-5 h-5 text-fun-yellow fill-fun-yellow" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className={`relative overflow-hidden bg-white border-border p-5 hover:border-fun-purple/30 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02] cursor-pointer ${stat.urgent ? "ring-2 ring-fun-pink/50" : ""}`}>
              {stat.urgent && (
                <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-fun-pink animate-ping" />
              )}
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3 shadow-sm`}>
                <div className={`bg-gradient-to-br ${stat.color} w-8 h-8 rounded-lg flex items-center justify-center`}>
                  <stat.icon className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-3xl font-black text-fun-dark-purple">{stat.value}</p>
              <p className="text-fun-text/60 text-xs mt-1 font-bold uppercase tracking-wider">{stat.title}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Children Balances */}
        <Card className="bg-white border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-fun-dark-purple font-black text-lg">Saldo Anak</h2>
            <Link href="/parent/children" className="text-fun-purple text-xs font-black uppercase tracking-wider hover:underline">
              Lihat semua →
            </Link>
          </div>
          {childrenWithBalance.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-fun-purple/20 mx-auto mb-3" />
              <p className="text-fun-text/40 text-sm font-semibold">Belum ada akun anak</p>
              <Link href="/parent/children">
                <Badge className="mt-2 bg-fun-purple hover:bg-fun-purple/90 cursor-pointer text-white font-bold border-none">
                  + Tambah Anak
                </Badge>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {childrenWithBalance.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center justify-between p-3 bg-fun-beige/50 border border-border/60 rounded-xl hover:bg-fun-beige transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-fun-purple flex items-center justify-center text-white font-black text-sm shadow-sm">
                      {child.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-fun-dark-purple font-black text-sm">{child.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-fun-yellow/20 border border-fun-yellow/30 rounded-full px-3 py-1 shadow-sm">
                    <Star className="w-3.5 h-3.5 text-fun-yellow fill-fun-yellow" />
                    <span className="text-fun-purple font-black text-sm">{child.balance}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card className="bg-white border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-fun-dark-purple font-black text-lg">Aktivitas Terbaru</h2>
            <Link href="/parent/validations" className="text-fun-purple text-xs font-black uppercase tracking-wider hover:underline">
              Lihat semua →
            </Link>
          </div>
          {recentLedgers.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-fun-purple/20 mx-auto mb-3" />
              <p className="text-fun-text/40 text-sm font-semibold">Belum ada aktivitas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentLedgers.map((ledger) => (
                <div
                  key={ledger.id}
                  className="flex items-center justify-between p-3 bg-fun-beige/50 border border-border/60 rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-fun-dark-purple text-xs font-black">
                      {typeLabels[ledger.type]}
                    </p>
                    <p className="text-fun-text/60 text-xs truncate font-semibold mt-0.5">
                      {(ledger as { profiles?: { name?: string } }).profiles?.name} • {ledger.points} poin
                    </p>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ml-2 flex-shrink-0 bg-white border border-border/60 ${statusColors[ledger.status]}`}>
                    {ledger.status === "pending" ? "Menunggu" : ledger.status === "approved" ? "Disetujui" : "Ditolak"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Settings / Reset Section */}
      <Card className="bg-white border-border p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-fun-dark-purple font-black text-lg flex items-center gap-2">
            <Settings className="w-5 h-5 text-fun-purple" />
            Pengaturan & Pemeliharaan Data
          </h2>
          <p className="text-fun-text/60 text-sm mt-1 font-semibold">
            Gunakan fitur ini untuk mereset seluruh data demo (misi, hadiah, dan riwayat) agar aplikasi siap digunakan anak Anda sekarang. Profil anak tetap aman.
          </p>
        </div>
        <div className="flex-shrink-0">
          <ResetDataButton />
        </div>
      </Card>
    </div>
  );
}
