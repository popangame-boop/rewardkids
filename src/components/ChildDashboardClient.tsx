"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { Mission, Ledger } from "@/types/supabase";
import { Star, Target, Clock, CheckCircle, XCircle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/lib/store";

interface ChildDashboardClientProps {
  initialBalance: number;
  initialActiveMissions: Mission[];
  initialRecentLedgers: Ledger[];
  childId: string;
  childName: string;
}

export function ChildDashboardClient({
  initialBalance,
  initialActiveMissions,
  initialRecentLedgers,
  childId,
  childName,
}: ChildDashboardClientProps) {
  const supabase = createClient();

  const { childBalances, setBalance, setMissions, missions: storeMissions } = useAppStore();

  // Sync balance using SWR
  const { data: swrBalance, mutate: mutateBalance, isLoading: balanceLoading } = useSWR<number>(
    ["balance", childId],
    async () => {
      const { data, error } = await supabase.rpc("get_child_balance", { p_user_id: childId });
      if (error) throw error;
      return data !== null ? data : 0;
    },
    {
      fallbackData: childBalances[childId] ?? initialBalance,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  useEffect(() => {
    if (swrBalance !== undefined) {
      setBalance(childId, swrBalance);
    }
  }, [swrBalance, childId, setBalance]);

  const balance = childBalances[childId] ?? swrBalance ?? initialBalance;

  // Sync recent ledgers using SWR
  const { data: recentLedgers = initialRecentLedgers, mutate: mutateLedgers, isLoading: ledgersLoading } = useSWR<Ledger[]>(
    ["recentLedgers", childId],
    async () => {
      const { data, error } = await supabase
        .from("ledgers")
        .select("*")
        .eq("user_id", childId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    {
      fallbackData: initialRecentLedgers,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  // Sync active missions in real-time
  const [activeMissions, , activeMissionsLoading] = useRealtimeTable<Mission>(
    "missions",
    initialActiveMissions,
    { filter: "is_active=eq.true" }
  );

  // Cache active missions to Zustand store
  useEffect(() => {
    if (activeMissions) {
      setMissions(activeMissions);
    }
  }, [activeMissions, setMissions]);



  // Sync balance and ledger events in real-time
  useEffect(() => {
    const channel = supabase
      .channel(`child-dashboard-sync-${childId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ledgers",
          filter: `user_id=eq.${childId}`,
        },
        () => {
          mutateBalance();
          mutateLedgers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [childId, supabase, mutateBalance, mutateLedgers]);

  const pendingCount = recentLedgers.filter((l) => l.status === "pending" && l.type === "earn").length;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return "Selamat Pagi";
    if (hour < 15) return "Selamat Siang";
    if (hour < 18) return "Selamat Sore";
    return "Selamat Malam";
  };

  const statusIcon = {
    pending: <Clock className="w-4 h-4 text-amber-400" />,
    approved: <CheckCircle className="w-4 h-4 text-green-400" />,
    rejected: <XCircle className="w-4 h-4 text-red-400" />,
  };

  const typeEmoji = { earn: "🎯", spend: "🎁", punish: "⚡" };

  const hasCachedData = childBalances[childId] !== undefined && storeMissions !== null;
  const isCurrentlyLoading = !hasCachedData && ((balanceLoading && initialBalance === 0) || (ledgersLoading && recentLedgers.length === 0) || (activeMissionsLoading && activeMissions.length === 0));

  if (isCurrentlyLoading) {
    return (
      <div className="space-y-6 max-w-lg mx-auto px-4 pt-6">
        <div className="space-y-2 animate-pulse">
          <Skeleton className="h-9 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-[1.8rem]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 space-y-6 max-w-lg mx-auto pb-12">
      {/* Greeting */}
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-widest text-fun-purple font-black">{greeting()}, 👋</p>
        <h1 className="text-4xl font-black text-fun-dark-purple leading-tight">
          Halo, {childName.split(" ")[0]}!
        </h1>
      </div>

      {/* Balance Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-fun-pink via-[#EA9FB8] to-[#E588A6] rounded-[2.2rem] p-6 shadow-xl shadow-fun-pink/15 border-2 border-white/40">
        <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/20 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-white/10 rounded-full blur-lg pointer-events-none" />

        <p className="text-white/80 text-xs font-bold uppercase tracking-wider relative">Total Bintangmu ⭐</p>
        <div className="flex items-center gap-3 mt-2 relative">
          <Star className="w-12 h-12 text-fun-yellow fill-fun-yellow drop-shadow-md animate-bounce-slow" />
          <span className="text-6xl font-black text-white drop-shadow-sm">{balance}</span>
        </div>
        <p className="text-white/90 text-xs mt-4 relative font-medium bg-black/10 rounded-full px-3 py-1.5 inline-block backdrop-blur-sm">
          {pendingCount > 0 ? `${pendingCount} tugas menunggu disetujui` : "Kumpulkan lebih banyak bintang! 🎉"}
        </p>
      </div>

      {/* Grid of quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/child/missions" className="bg-fun-purple text-white p-5 rounded-[1.8rem] shadow-md hover:shadow-lg transition-all active:scale-[0.98] relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/10 rounded-full group-hover:scale-110 transition-transform" />
          <span className="text-2xl block mb-2">🎯</span>
          <p className="text-white/70 text-xs font-black uppercase tracking-wider">Tugas Seru</p>
          <p className="text-white font-extrabold text-lg mt-0.5">Misi Baru</p>
        </Link>
        <Link href="/child/rewards" className="bg-fun-yellow text-fun-dark-purple p-5 rounded-[1.8rem] shadow-md hover:shadow-lg transition-all active:scale-[0.98] relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-black/5 rounded-full group-hover:scale-110 transition-transform" />
          <span className="text-2xl block mb-2">🏆</span>
          <p className="text-fun-dark-purple/60 text-xs font-black uppercase tracking-wider">Klaim Poin</p>
          <p className="text-fun-dark-purple font-extrabold text-lg mt-0.5">Hadiahku</p>
        </Link>
      </div>

      {/* Active Missions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-fun-dark-purple font-black text-lg">Misi Untukmu 🎯</h2>
          <Link href="/child/missions" className="text-fun-purple text-xs font-black uppercase tracking-wider flex items-center gap-1 hover:underline">
            Semua <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {activeMissions.length === 0 ? (
          <div className="bg-white border border-border rounded-[1.8rem] p-8 text-center shadow-sm">
            <Target className="w-12 h-12 text-fun-purple/20 mx-auto mb-2" />
            <p className="text-fun-text/40 text-sm font-bold">Belum ada misi aktif</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeMissions.slice(0, 3).map((mission) => (
              <Link key={mission.id} href="/child/missions">
                <div className="bg-white border border-border rounded-[1.5rem] p-4 flex items-center gap-4 hover:border-fun-purple/30 hover:shadow-sm transition-all active:scale-[0.99]">
                  <span className="text-3xl bg-fun-beige w-12 h-12 rounded-2xl flex items-center justify-center">{mission.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-fun-dark-purple font-black text-sm truncate">{mission.title}</p>
                    {mission.category && (
                      <p className="text-fun-text/50 text-xs font-semibold">{mission.category}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 bg-fun-yellow/20 rounded-full px-3 py-1.5 flex-shrink-0">
                    <Star className="w-3.5 h-3.5 text-fun-yellow fill-fun-yellow" />
                    <span className="text-fun-purple font-black text-xs">+{mission.point_reward}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-fun-dark-purple font-black text-lg">Aktivitas Terbaru 📋</h2>
          <Link href="/child/history" className="text-fun-purple text-xs font-black uppercase tracking-wider flex items-center gap-1 hover:underline">
            Semua <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {recentLedgers.length === 0 ? (
          <div className="bg-white border border-border rounded-[1.8rem] p-8 text-center shadow-sm">
            <Clock className="w-12 h-12 text-fun-purple/20 mx-auto mb-2" />
            <p className="text-fun-text/40 text-sm font-bold">Belum ada aktivitas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentLedgers.map((ledger) => (
              <div key={ledger.id} className="bg-white border border-border rounded-[1.5rem] px-4 py-3 flex items-center gap-3 shadow-sm">
                <span className="text-2xl bg-fun-beige w-10 h-10 rounded-xl flex items-center justify-center">{typeEmoji[ledger.type as keyof typeof typeEmoji]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-fun-dark-purple text-sm font-extrabold truncate">{ledger.description}</p>
                  <p className="text-fun-text/40 text-xs font-bold">
                    {new Date(ledger.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-black text-sm ${ledger.type === "earn" ? "text-fun-teal" : "text-fun-pink"}`}>
                    {ledger.type === "earn" ? "+" : "-"}{ledger.points}
                  </span>
                  {statusIcon[ledger.status as keyof typeof statusIcon]}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
