"use client";

import { useState } from "react";
import { Reward } from "@/types/supabase";
import { redeemReward } from "@/app/actions/ledgers";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Star, Gift, Package, Loader2, Lock } from "lucide-react";
import Image from "next/image";

interface ChildRewardsClientProps {
  rewards: Reward[];
  balance: number;
}

export function ChildRewardsClient({ rewards, balance: initialBalance }: ChildRewardsClientProps) {
  const [balance, setBalance] = useState(initialBalance);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRedeem = async () => {
    if (!selectedReward) return;
    setLoading(true);
    try {
      await redeemReward(selectedReward.id);
      toast.success(`Penukaran "${selectedReward.title}" berhasil! 🎁\nMenunggu persetujuan orang tua.`);
      setBalance(balance - selectedReward.point_cost);
      setSelectedReward(null);
    } catch (error) {
      toast.error(String(error));
    }
    setLoading(false);
  };

  const canAfford = (reward: Reward) => balance >= reward.point_cost;

  return (
    <div className="px-4 pt-6 pb-2 space-y-6 max-w-lg mx-auto">
      {/* Header + Balance */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-fun-dark-purple">Katalog Hadiah 🎁</h1>
          <p className="text-fun-text/60 text-sm mt-1 font-semibold">Tukar bintangmu!</p>
        </div>
        <div className="flex items-center gap-1.5 bg-fun-yellow/20 border border-fun-yellow/30 rounded-2xl px-3 py-2 shadow-sm">
          <Star className="w-4 h-4 text-fun-yellow fill-fun-yellow" />
          <span className="text-fun-purple font-black text-lg">{balance}</span>
        </div>
      </div>

      {rewards.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-border shadow-sm">
          <div className="text-6xl mb-4">🎁</div>
          <p className="text-fun-dark-purple font-extrabold">Belum ada hadiah</p>
          <p className="text-fun-text/40 text-sm font-semibold">Orang tua belum menambahkan hadiah</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {rewards.map((reward) => {
            const affordable = canAfford(reward);
            const outOfStock = reward.stock === 0;
            const disabled = !affordable || outOfStock;

            return (
              <div
                key={reward.id}
                onClick={() => !disabled && setSelectedReward(reward)}
                className={`relative rounded-[1.8rem] overflow-hidden border transition-all ${
                  disabled
                    ? "border-border opacity-60 cursor-not-allowed bg-white/40"
                    : "border-border cursor-pointer hover:border-fun-purple/30 hover:shadow-md active:scale-[0.98]"
                } bg-white shadow-sm`}
              >
                {/* Image */}
                <div className="h-28 bg-fun-beige flex items-center justify-center relative">
                  {reward.image_url ? (
                    <Image
                      src={reward.image_url}
                      alt={reward.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <Gift className="w-12 h-12 text-fun-purple/20" />
                  )}
                  {outOfStock && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                      <span className="text-white text-xs font-black bg-fun-pink px-2.5 py-1 rounded-full shadow-md">Habis</span>
                    </div>
                  )}
                  {!affordable && !outOfStock && (
                    <div className="absolute top-2 right-2 bg-black/40 rounded-full p-1.5 backdrop-blur-sm shadow-md">
                      <Lock className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>

                <div className="p-3.5 space-y-2">
                  <p className="text-fun-dark-purple font-black text-xs leading-tight line-clamp-2">{reward.title}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-fun-yellow/20 rounded-full px-2 py-0.5">
                      <Star className="w-2.5 h-2.5 text-fun-yellow fill-fun-yellow" />
                      <span className="text-fun-purple font-black text-xs">{reward.point_cost}</span>
                    </div>
                    {reward.stock !== -1 && (
                      <div className="flex items-center gap-0.5 text-fun-text/40 text-[10px] font-bold">
                        <Package className="w-2.5 h-2.5" />
                        {reward.stock}
                      </div>
                    )}
                  </div>

                  {!affordable && !outOfStock && (
                    <p className="text-fun-pink text-[10px] font-black uppercase tracking-wider mt-1">
                      Kurang {reward.point_cost - balance} ⭐
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Dialog */}
      <AlertDialog open={!!selectedReward} onOpenChange={(v) => !v && setSelectedReward(null)}>
        <AlertDialogContent className="bg-white border-border rounded-[2.2rem] text-fun-text max-w-sm mx-auto shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-fun-dark-purple font-black text-center text-lg">
              Tukar Hadiah? 🎁
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              <div className="space-y-3 mt-3">
                {selectedReward?.image_url && (
                  <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-border">
                    <Image src={selectedReward.image_url} alt={selectedReward.title} fill className="object-cover" />
                  </div>
                )}
                <p className="text-fun-dark-purple font-black text-base leading-snug">{selectedReward?.title}</p>
                <div className="flex items-center justify-center gap-2 bg-fun-yellow/20 border border-fun-yellow/30 rounded-2xl py-2">
                  <Star className="w-5 h-5 text-fun-yellow fill-fun-yellow" />
                  <span className="text-fun-purple font-black text-xl">{selectedReward?.point_cost}</span>
                  <span className="text-fun-purple/60 text-sm font-bold">poin</span>
                </div>
                <p className="text-fun-text/60 text-sm font-medium">Sisa poinmu nanti: {balance - (selectedReward?.point_cost ?? 0)} ⭐</p>
                <p className="text-fun-text/40 text-xs font-bold bg-fun-beige p-2 rounded-xl">Penukaran ini akan dikonfirmasi oleh Orang Tua terlebih dahulu</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:flex-row pt-2">
            <AlertDialogCancel className="flex-1 border-border text-fun-text hover:bg-fun-beige rounded-xl font-bold">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRedeem}
              disabled={loading}
              className="flex-1 bg-fun-purple hover:bg-fun-purple/90 text-white font-black rounded-xl shadow-lg shadow-fun-purple/20 border-none"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Proses...</> : "Tukar! 🎉"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
