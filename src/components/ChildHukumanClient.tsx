"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Punishment, Ledger } from "@/types/supabase";
import { Star, ShieldAlert, AlertTriangle, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface ChildHukumanClientProps {
  punishments: Punishment[];
  ledgers: Ledger[];
  childId: string;
}

export function ChildHukumanClient({ punishments: initialPunishments, ledgers: initialLedgers, childId }: ChildHukumanClientProps) {
  const supabase = createClient();
  const [selectedPunishment, setSelectedPunishment] = useState<Punishment | null>(null);

  // Sync punishments in real-time
  const [punishments, , punishmentsLoading] = useRealtimeTable<Punishment>(
    "punishments",
    initialPunishments,
    { filter: "is_active=eq.true" }
  );

  // Sync punishment ledgers using SWR
  const { data: ledgers = initialLedgers, mutate: mutateLedgers, isLoading: ledgersLoading } = useSWR<Ledger[]>(
    ["hukumanLedgers", childId],
    async () => {
      const { data, error } = await supabase
        .from("ledgers")
        .select("*")
        .eq("user_id", childId)
        .eq("type", "punish")
        .eq("status", "approved");
      if (error) throw error;
      return data || [];
    },
    {
      fallbackData: initialLedgers,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );



  useEffect(() => {
    const channel = supabase
      .channel(`child-punish-ledgers-${childId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ledgers",
          filter: `user_id=eq.${childId}`,
        },
        () => {
          mutateLedgers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [childId, supabase, mutateLedgers]);

  // Helper to count how many times a punishment was received
  const getCount = (punishmentId: string) => {
    return ledgers.filter((l) => l.punishment_id === punishmentId).length;
  };

  // Helper to calculate total points deducted
  const totalDeducted = ledgers.reduce((sum, l) => sum + l.points, 0);
  const totalTimes = ledgers.length;

  const isCurrentlyLoading = (punishmentsLoading && initialPunishments.length === 0) || (ledgersLoading && initialLedgers.length === 0);

  if (isCurrentlyLoading) {
    return (
      <div className="px-4 pt-6 pb-2 space-y-6 max-w-lg mx-auto">
        <div className="space-y-2 animate-pulse">
          <Skeleton className="h-9 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 rounded-xl" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-[1.8rem]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-2 space-y-6 max-w-lg mx-auto">
      {/* Header + Stats */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-black text-fun-dark-purple">Daftar Hukuman ⚡</h1>
          <p className="text-fun-text/60 text-sm mt-1 font-semibold">
            Konsekuensi jika melanggar peraturan. Tetap patuh ya!
          </p>
        </div>

        {/* Stats Summary Panel */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-50/60 border border-red-100 rounded-[1.8rem] p-4 flex flex-col justify-between shadow-sm">
            <span className="text-fun-text/50 text-[11px] font-bold uppercase tracking-wider">Total Melanggar</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-red-500 font-black text-2xl">{totalTimes}</span>
              <span className="text-fun-text/60 text-xs font-bold">kali</span>
            </div>
          </div>
          <div className="bg-orange-50/60 border border-orange-100 rounded-[1.8rem] p-4 flex flex-col justify-between shadow-sm">
            <span className="text-fun-text/50 text-[11px] font-bold uppercase tracking-wider">Poin Berkurang</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-orange-500 font-black text-2xl">-{totalDeducted}</span>
              <Star className="w-4 h-4 text-fun-yellow fill-fun-yellow inline" />
            </div>
          </div>
        </div>
      </div>

      {/* Rules list */}
      {punishments.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[1.8rem] border border-border shadow-sm">
          <div className="text-6xl mb-4">😇</div>
          <p className="text-fun-dark-purple font-extrabold">Tidak ada peraturan hukuman</p>
          <p className="text-fun-text/40 text-sm font-semibold">Orang tua belum menetapkan hukuman apa pun</p>
        </div>
      ) : (
        <div className="space-y-3">
          {punishments.map((punishment) => {
            const count = getCount(punishment.id);
            return (
              <div
                key={punishment.id}
                onClick={() => setSelectedPunishment(
                  selectedPunishment?.id === punishment.id ? null : punishment
                )}
                className={`p-4 rounded-[1.8rem] border bg-white transition-all shadow-sm cursor-pointer hover:shadow-md hover:border-fun-purple/20 ${
                  selectedPunishment?.id === punishment.id ? "ring-2 ring-fun-purple/30" : ""
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-2xl flex-shrink-0">
                    {punishment.icon || "⚠️"}
                  </div>

                  {/* Title & Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-fun-dark-purple font-black text-sm leading-tight">
                        {punishment.title}
                      </p>
                      <Badge className="bg-red-50 text-red-500 hover:bg-red-100 border-none font-bold text-[10px] px-2 py-0.5 whitespace-nowrap">
                        -{punishment.point_penalty} ⭐
                      </Badge>
                    </div>

                    <p className="text-fun-text/60 text-xs font-semibold line-clamp-2">
                      {punishment.description || "Tidak ada deskripsi peraturan."}
                    </p>

                    {/* Footer Row */}
                    <div className="flex items-center justify-between pt-1 text-[11px] font-bold">
                      <span className={`${count > 0 ? "text-red-500 font-extrabold" : "text-fun-text/30"}`}>
                        Sudah didapat: {count} kali
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedPunishment?.id === punishment.id && punishment.description && (
                  <div className="mt-4 pt-3 border-t border-dashed border-border/80 text-xs text-fun-text/70 leading-relaxed font-semibold">
                    <p className="flex items-center gap-1.5 text-fun-dark-purple font-bold mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                      Detail Peraturan:
                    </p>
                    {punishment.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Advice Card */}
      <div className="bg-fun-purple/5 border border-fun-purple/10 rounded-[1.8rem] p-4 flex gap-3.5 items-start">
        <div className="w-8 h-8 rounded-full bg-fun-purple/10 flex items-center justify-center text-fun-purple flex-shrink-0">
          <HelpCircle className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <h4 className="text-fun-dark-purple font-extrabold text-xs">Mengapa ada Hukuman?</h4>
          <p className="text-fun-text/60 text-[11px] leading-normal font-semibold">
            Hukuman dibuat oleh Orang Tua untuk membantumu belajar disiplin dan bertanggung jawab. Kerjakan misimu dengan baik dan hindari melanggar aturan ya!
          </p>
        </div>
      </div>
    </div>
  );
}
