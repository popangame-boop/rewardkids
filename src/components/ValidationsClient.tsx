"use client";

import { useState, useEffect, useOptimistic, useTransition } from "react";
import useSWR from "swr";
import { approveLedger, rejectLedger } from "@/app/actions/ledgers";
import { getComments, addComment } from "@/app/actions/comments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle, XCircle, Image as ImageIcon, Star, Clock, MessageSquare, Send, Loader2 } from "lucide-react";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";

type LedgerWithProfile = {
  id: string;
  user_id: string;
  type: string;
  points: number;
  description: string | null;
  status: string;
  proof_image_url: string | null;
  proof_image_urls: string[] | null;
  created_at: string;
  profiles: { name: string; avatar_url: string | null } | null;
};

interface ValidationsClientProps {
  initialLedgers: LedgerWithProfile[];
}

export function ValidationsClient({ initialLedgers }: ValidationsClientProps) {
  const supabase = createClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [proofDialog, setProofDialog] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Sync validation queue using SWR
  const { data: ledgers = initialLedgers, mutate: mutateLedgers, isLoading } = useSWR<LedgerWithProfile[]>(
    "validationLedgers",
    async () => {
      const { data, error } = await supabase
        .from("ledgers")
        .select("*, profiles!ledgers_user_id_fkey(name, avatar_url)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    {
      fallbackData: initialLedgers,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  // React 19 useOptimistic for Zero-Latency approval/rejection validation queue
  const [optimisticLedgers, setOptimisticLedgers] = useOptimistic(
    ledgers,
    (state, idToRemove: string) => state.filter((l) => l.id !== idToRemove)
  );

  // Sync validation queue in real-time
  useEffect(() => {
    const fetchLedgerWithProfile = async (id: string): Promise<LedgerWithProfile | null> => {
      const { data, error } = await supabase
        .from("ledgers")
        .select("*, profiles!ledgers_user_id_fkey(name, avatar_url)")
        .eq("id", id)
        .single();
      if (error || !data) return null;
      return data as LedgerWithProfile;
    };

    const channel = supabase
      .channel("parent-validation-ledgers")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ledgers",
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newLedger = payload.new;
            if (newLedger.status === "pending") {
              const fullLedger = await fetchLedgerWithProfile(newLedger.id);
              if (fullLedger) {
                mutateLedgers((prev) => [fullLedger, ...(prev || [])], false);
                // Play notification sound
                try {
                  const audio = new Audio("/sounds/notification.mp3");
                  audio.play().catch(() => {});
                } catch (e) {}
              }
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedLedger = payload.new;
            if (updatedLedger.status !== "pending") {
              // Remove approved/rejected items from the validation queue
              mutateLedgers((prev) => (prev || []).filter((l) => l.id !== updatedLedger.id), false);
            } else {
              const fullLedger = await fetchLedgerWithProfile(updatedLedger.id);
              if (fullLedger) {
                mutateLedgers(
                  (prev) =>
                    (prev || []).map((l) => (l.id === fullLedger.id ? fullLedger : l)),
                  false
                );
              }
            }
          } else if (payload.eventType === "DELETE") {
            const oldId = payload.old.id;
            mutateLedgers((prev) => (prev || []).filter((l) => l.id !== oldId), false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, mutateLedgers]);

  // Comments State
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [shownComments, setShownComments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const channel = supabase
      .channel("parent-comments-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ledger_comments",
        },
        async (payload) => {
          const newComment = payload.new;
          const ledgerId = newComment.ledger_id;
          if (comments[ledgerId]) {
            const updatedComments = await getComments(ledgerId);
            setComments((prev) => ({ ...prev, [ledgerId]: updatedComments }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [comments, supabase]);

  const toggleComments = async (ledgerId: string) => {
    if (shownComments[ledgerId]) {
      setShownComments((prev) => ({ ...prev, [ledgerId]: false }));
      return;
    }

    setShownComments((prev) => ({ ...prev, [ledgerId]: true }));
    if (!comments[ledgerId]) {
      setCommentsLoading((prev) => ({ ...prev, [ledgerId]: true }));
      try {
        const data = await getComments(ledgerId);
        setComments((prev) => ({ ...prev, [ledgerId]: data }));
      } catch (err) {
        toast.error("Gagal memuat komentar");
      }
      setCommentsLoading((prev) => ({ ...prev, [ledgerId]: false }));
    }
  };

  const handleSendComment = async (ledgerId: string) => {
    const text = commentInputs[ledgerId]?.trim();
    if (!text) return;

    try {
      await addComment(ledgerId, text);
      const updatedComments = await getComments(ledgerId);
      setComments((prev) => ({ ...prev, [ledgerId]: updatedComments }));
      setCommentInputs((prev) => ({ ...prev, [ledgerId]: "" }));
      toast.success("Komentar terkirim! 💬");
    } catch (err) {
      toast.error("Gagal mengirim komentar");
    }
  };

  const handleApprove = async (id: string) => {
    toast.success("Tugas disetujui! ✅");

    startTransition(async () => {
      setOptimisticLedgers(id);
      try {
        await approveLedger(id);
        await mutateLedgers();
      } catch (error) {
        toast.error("Gagal menyetujui tugas: " + String(error));
      }
    });
  };

  const openReject = (id: string) => {
    setSelectedLedgerId(id);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedLedgerId) return;
    const id = selectedLedgerId;
    setRejectDialogOpen(false);
    toast.success("Tugas ditolak");

    startTransition(async () => {
      setOptimisticLedgers(id);
      try {
        await rejectLedger(id, rejectReason);
        await mutateLedgers();
      } catch (error) {
        toast.error("Gagal menolak tugas: " + String(error));
      }
    });
  };

  const typeLabels: Record<string, string> = {
    earn: "🎯 Selesai Misi",
    spend: "🎁 Tukar Hadiah",
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading && initialLedgers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 rounded-xl" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white border border-border rounded-[1.8rem] p-5 space-y-4 shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
              </div>
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-5/6 rounded" />
              <div className="flex justify-between items-center pt-2">
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-fun-dark-purple">Validasi Tugas ✅</h1>
        <p className="text-fun-text/60 text-sm mt-1 font-semibold">
          {optimisticLedgers.length > 0
            ? `${optimisticLedgers.length} tugas menunggu persetujuanmu`
            : "Semua tugas sudah divalidasi!"}
        </p>
      </div>

      {optimisticLedgers.length === 0 ? (
        <div className="text-center py-20 bg-white border border-border rounded-[2.2rem] shadow-sm">
          <CheckCircle className="w-16 h-16 text-fun-teal mx-auto mb-4 animate-bounce-slow" />
          <p className="text-fun-dark-purple font-black text-xl">Semua beres! 🎉</p>
          <p className="text-fun-text/40 text-sm mt-1 font-semibold">Tidak ada tugas yang perlu divalidasi</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {optimisticLedgers.map((ledger) => (
            <div
              key={ledger.id}
              className="bg-white border border-border rounded-[1.8rem] p-5 space-y-4 hover:shadow-md transition-all shadow-sm flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-fun-purple flex items-center justify-center text-white font-black flex-shrink-0 shadow-md">
                    {ledger.profiles?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-fun-dark-purple font-black text-sm truncate">{ledger.profiles?.name}</p>
                    <p className="text-fun-text/40 text-[10px] font-bold uppercase tracking-wider">{typeLabels[ledger.type]}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-fun-yellow/20 border border-fun-yellow/30 rounded-full px-2.5 py-1">
                    <Star className="w-3.5 h-3.5 text-fun-yellow fill-fun-yellow" />
                    <span className="text-fun-purple font-black text-xs">{ledger.points}</span>
                  </div>
                </div>

                {/* Description */}
                {ledger.description && (
                  <p className="text-fun-dark-purple text-sm bg-fun-beige rounded-xl px-3 py-2 border border-border font-medium">
                    {ledger.description}
                  </p>
                )}

                {/* Proof Images */}
                {ledger.proof_image_urls && ledger.proof_image_urls.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {ledger.proof_image_urls.map((url, idx) => (
                      <button
                        key={idx}
                        onClick={() => setProofDialog(url)}
                        className="w-full aspect-square rounded-xl overflow-hidden bg-fun-beige border border-border relative hover:opacity-90 transition-opacity cursor-pointer group"
                      >
                        <Image
                          src={url}
                          alt={`Bukti tugas ${idx + 1}`}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ImageIcon className="w-5 h-5 text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : ledger.proof_image_url ? (
                  <button
                    onClick={() => setProofDialog(ledger.proof_image_url!)}
                    className="w-full h-32 rounded-xl overflow-hidden bg-fun-beige border border-border relative hover:opacity-90 transition-opacity cursor-pointer group"
                  >
                    <Image
                      src={ledger.proof_image_url}
                      alt="Bukti tugas"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ImageIcon className="w-8 h-8 text-white" />
                    </div>
                  </button>
                ) : (
                  <div className="w-full h-20 rounded-xl bg-fun-beige border border-dashed border-border flex items-center justify-center">
                    <p className="text-fun-text/30 text-xs font-semibold">Tidak ada foto bukti</p>
                  </div>
                )}

                {/* Comments Section */}
                <div className="space-y-2">
                  <button
                    onClick={() => toggleComments(ledger.id)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-fun-purple/5 hover:bg-fun-purple/10 border border-fun-purple/10 rounded-xl text-xs font-bold text-fun-purple transition-all cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Komentar & Umpan Balik
                    </span>
                    <span className="bg-fun-purple/20 text-fun-purple px-2 py-0.5 rounded-full text-[10px]">
                      {comments[ledger.id]?.length ?? 0}
                    </span>
                  </button>

                  {shownComments[ledger.id] && (
                    <div className="space-y-3 pt-1 border-t border-border/40 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                        {commentsLoading[ledger.id] ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-4 h-4 text-fun-purple animate-spin" />
                          </div>
                        ) : !comments[ledger.id] || comments[ledger.id].length === 0 ? (
                          <p className="text-[10px] text-fun-text/40 text-center font-bold py-2">Belum ada komentar.</p>
                        ) : (
                          comments[ledger.id].map((comment) => {
                            const isParent = comment.profiles?.role === "parent";
                            return (
                              <div
                                key={comment.id}
                                className={`p-2 rounded text-xs leading-normal max-w-[85%] ${
                                  isParent
                                    ? "bg-fun-purple/10 text-fun-dark-purple ml-auto rounded-tr-none"
                                    : "bg-fun-beige border border-border text-fun-text mr-auto rounded-tl-none"
                                }`}
                              >
                                <p className="text-[9px] font-black text-fun-purple/70 leading-none mb-1">
                                  {isParent ? "Anda" : comment.profiles?.name}
                                </p>
                                <p className="font-semibold">{comment.content}</p>
                              </div>
                            );
                          })
                        )}
                      </div>
                      {/* Add Comment Input */}
                      <div className="flex gap-1.5 items-center">
                        <Input
                          value={commentInputs[ledger.id] || ""}
                          onChange={(e) =>
                              setCommentInputs((prev) => ({ ...prev, [ledger.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSendComment(ledger.id);
                          }}
                          placeholder="Beri masukan..."
                          className="h-8 rounded-md text-xs bg-fun-beige border-border flex-1 py-1"
                        />
                        <Button
                          onClick={() => handleSendComment(ledger.id)}
                          size="icon"
                          className="w-8 h-8 rounded-lg bg-fun-purple hover:bg-fun-purple/95 flex-shrink-0 flex items-center justify-center p-0 border-none shadow-md shadow-fun-purple/10 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5 text-white" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-border/60">
                {/* Time */}
                <div className="flex items-center gap-1.5 text-fun-text/40 text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDate(ledger.created_at)}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApprove(ledger.id)}
                    disabled={isPending}
                    className="flex-1 bg-fun-teal hover:bg-fun-teal/90 text-white font-black rounded-xl h-10 text-xs gap-1 border-none shadow-md shadow-fun-teal/10 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Setujui
                  </Button>
                  <Button
                    onClick={() => openReject(ledger.id)}
                    disabled={isPending}
                    variant="outline"
                    className="flex-1 border-fun-pink text-fun-pink hover:bg-fun-pink/5 hover:border-fun-pink rounded-xl h-10 text-xs gap-1 font-bold cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    Tolak
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-white border-border rounded-[2.2rem] text-fun-text max-w-sm mx-auto shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-fun-dark-purple font-black text-center text-lg">Alasan Penolakan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-fun-dark-purple font-bold">Berikan alasan (opsional)</Label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Foto kurang jelas, coba ambil ulang ya"
                className="bg-fun-beige border-border text-fun-dark-purple placeholder:text-fun-text/30 rounded-md"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)} className="flex-1 border-border text-fun-text rounded-xl font-bold hover:bg-fun-beige cursor-pointer">
                Batal
              </Button>
              <Button onClick={handleReject} className="flex-1 bg-fun-pink hover:bg-fun-pink/90 text-white rounded-xl font-black border-none shadow-md shadow-fun-pink/15 cursor-pointer">
                Tolak Tugas
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Proof Image Dialog */}
      <Dialog open={!!proofDialog} onOpenChange={() => setProofDialog(null)}>
        <DialogContent className="bg-white border-border rounded-[2.2rem] max-w-lg p-2 shadow-2xl">
          {proofDialog && (
            <div className="relative w-full aspect-square rounded-[1.8rem] overflow-hidden">
              <Image src={proofDialog} alt="Bukti tugas" fill className="object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
