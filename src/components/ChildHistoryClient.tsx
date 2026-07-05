"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Clock, Star, MessageSquare, Send, Loader2 } from "lucide-react";
import { getComments, addComment } from "@/app/actions/comments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Ledger = {
  id: string;
  user_id: string;
  type: string;
  points: number;
  description: string | null;
  status: string;
  proof_image_url: string | null;
  rejection_reason: string | null;
  created_at: string;
};

interface ChildHistoryClientProps {
  initialLedgers: Ledger[];
}

export function ChildHistoryClient({ initialLedgers }: ChildHistoryClientProps) {
  const [ledgers, setLedgers] = useState<Ledger[]>(initialLedgers);

  // Comments State
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [shownComments, setShownComments] = useState<Record<string, boolean>>({});

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
      toast.success("Komentar dikirim! 💬");
    } catch (err) {
      toast.error("Gagal mengirim komentar");
    }
  };

  const typeConfig = {
    earn: { emoji: "🎯", label: "Selesai Misi", color: "text-fun-teal", sign: "+" },
    spend: { emoji: "🎁", label: "Tukar Hadiah", color: "text-fun-pink", sign: "-" },
    punish: { emoji: "⚡", label: "Punishment", color: "text-fun-pink", sign: "-" },
  };

  const statusConfig = {
    pending: { icon: <Clock className="w-4 h-4 text-fun-purple" />, label: "Menunggu", bg: "bg-fun-yellow/10 border-fun-yellow/35 text-fun-purple" },
    approved: { icon: <CheckCircle className="w-4 h-4 text-fun-teal" />, label: "Disetujui", bg: "bg-fun-teal/10 border-fun-teal/35 text-fun-teal" },
    rejected: { icon: <XCircle className="w-4 h-4 text-fun-pink" />, label: "Ditolak", bg: "bg-fun-pink/10 border-fun-pink/35 text-fun-pink" },
  };

  // Group by month
  const grouped: Record<string, Ledger[]> = {};
  for (const ledger of ledgers) {
    const key = new Date(ledger.created_at).toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ledger);
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([month, items]) => (
        <div key={month} className="space-y-3">
          <h2 className="text-fun-purple font-black text-xs uppercase tracking-wider pl-1">{month}</h2>
          <div className="space-y-3">
            {items.map((ledger) => {
              const type = typeConfig[ledger.type as keyof typeof typeConfig] || typeConfig.earn;
              const status = statusConfig[ledger.status as keyof typeof statusConfig] || statusConfig.pending;

              return (
                <div key={ledger.id} className={`bg-white border ${status.bg} rounded-[1.5rem] px-4 py-3.5 shadow-sm space-y-3`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">{type.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-fun-dark-purple font-black text-sm leading-tight">{ledger.description}</p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Star className="w-3.5 h-3.5 text-fun-yellow fill-fun-yellow" />
                          <span className={`font-black text-sm ${type.color}`}>
                            {type.sign}{ledger.points}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center gap-1">
                          {status.icon}
                          <span className="text-xs font-bold text-fun-text/60">{status.label}</span>
                        </div>
                        <span className="text-border text-xs">•</span>
                        <span className="text-fun-text/40 text-xs font-bold">
                          {new Date(ledger.created_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {ledger.rejection_reason && (
                        <p className="text-fun-pink text-xs mt-2 bg-fun-pink/10 border border-fun-pink/20 rounded-lg px-2 py-1.5 font-bold">
                          ❌ Catatan Orang Tua: {ledger.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Comments Thread for Child */}
                  <div className="border-t border-border/20 pt-2 space-y-2">
                    <button
                      onClick={() => toggleComments(ledger.id)}
                      className="w-full flex items-center justify-between text-[11px] font-bold text-fun-purple/80 hover:text-fun-purple transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Tanya / Diskusi dengan Orang Tua
                      </span>
                      <span className="bg-fun-purple/15 text-fun-purple px-2 py-0.5 rounded-full text-[9px]">
                        {comments[ledger.id]?.length ?? 0}
                      </span>
                    </button>

                    {shownComments[ledger.id] && (
                      <div className="space-y-3 pt-1 border-t border-border/10 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                          {commentsLoading[ledger.id] ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="w-4 h-4 text-fun-purple animate-spin" />
                            </div>
                          ) : !comments[ledger.id] || comments[ledger.id].length === 0 ? (
                            <p className="text-[9px] text-fun-text/40 text-center font-bold py-2">Belum ada obrolan.</p>
                          ) : (
                            comments[ledger.id].map((comment) => {
                              const isParent = comment.profiles?.role === "parent";
                              return (
                                 <div
                                   key={comment.id}
                                   className={`p-2 rounded text-xs leading-normal max-w-[85%] ${
                                     !isParent
                                       ? "bg-fun-purple/10 text-fun-dark-purple ml-auto rounded-tr-none"
                                       : "bg-fun-beige border border-border text-fun-text mr-auto rounded-tl-none"
                                   }`}
                                 >
                                  <p className="text-[9px] font-black text-fun-purple/70 leading-none mb-1">
                                    {isParent ? "Orang Tua" : "Kamu"}
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
                            placeholder="Kirim pesan ke orang tua..."
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
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
