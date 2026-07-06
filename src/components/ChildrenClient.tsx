"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { createChildAccount, resetChildActivity } from "@/app/actions/children";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Star, Users, Eye, EyeOff, RotateCcw } from "lucide-react";
import { Profile } from "@/types/supabase";

type ChildWithBalance = Profile & { balance: number };

interface ChildrenClientProps {
  initialChildren: ChildWithBalance[];
  parentId: string;
}

export function ChildrenClient({ initialChildren, parentId }: ChildrenClientProps) {
  const supabase = createClient();
  const [children, setChildren] = useState(initialChildren);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    pin: "",
  });

  const { data: swrChildren, isLoading } = useSWR<ChildWithBalance[]>(
    ["parentChildrenData", parentId],
    async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "child")
        .eq("parent_id", parentId)
        .order("created_at", { ascending: true });
      if (!profiles) return [];
      const childrenWithBal = await Promise.all(
        profiles.map(async (child) => {
          const { data: balance } = await supabase.rpc("get_child_balance", {
            p_user_id: child.id,
          });
          return { ...child, balance: balance ?? 0 } as ChildWithBalance;
        })
      );
      return childrenWithBal;
    }
  );

  useEffect(() => {
    if (swrChildren) {
      setChildren(swrChildren);
    }
  }, [swrChildren]);



  // Sync children profiles and balances in real-time
  useEffect(() => {
    const fetchChildWithBalance = async (id: string): Promise<ChildWithBalance | null> => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();
      if (!profile) return null;
      const { data: balance } = await supabase.rpc("get_child_balance", { p_user_id: id });
      return { ...profile, balance: balance ?? 0 } as ChildWithBalance;
    };

    // 1. Subscribe to profiles changes under this parent
    const profilesChannel = supabase
      .channel("parent-children-profiles")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `parent_id=eq.${parentId}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const childWithBal = await fetchChildWithBalance(payload.new.id);
            if (childWithBal) {
              setChildren((prev) => [...prev, childWithBal]);
            }
          } else if (payload.eventType === "UPDATE") {
            const childWithBal = await fetchChildWithBalance(payload.new.id);
            if (childWithBal) {
              setChildren((prev) =>
                prev.map((c) => (c.id === childWithBal.id ? childWithBal : c))
              );
            }
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setChildren((prev) => prev.filter((c) => c.id !== deletedId));
          }
        }
      )
      .subscribe();

    // 2. Subscribe to ledgers to recalculate balance
    const ledgersChannel = supabase
      .channel("parent-children-ledgers")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ledgers",
        },
        async (payload) => {
          const ledger = (payload.new || payload.old) as any;
          if (ledger && ledger.user_id) {
            // Check if this ledger belongs to one of our children
            const exists = children.some((c) => c.id === ledger.user_id);
            if (exists || payload.eventType === "INSERT") {
              const updatedChild = await fetchChildWithBalance(ledger.user_id);
              if (updatedChild && updatedChild.parent_id === parentId) {
                setChildren((prev) => {
                  const alreadyListed = prev.some((c) => c.id === updatedChild.id);
                  if (alreadyListed) {
                    return prev.map((c) => (c.id === updatedChild.id ? updatedChild : c));
                  } else {
                    return [...prev, updatedChild];
                  }
                });
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(ledgersChannel);
    };
  }, [parentId, supabase, children]);

  const handleResetActivity = async (childId: string, childName: string) => {
    const originalChildren = children;

    // Optimistic Update: Set child balance/activity to 0 immediately in UI
    setChildren((prev) =>
      prev.map((c) => (c.id === childId ? { ...c, balance: 0 } : c))
    );
    toast.success(`Aktivitas dan poin ${childName} berhasil direset ke 0! 🎉`);

    try {
      await resetChildActivity(childId);
    } catch (error) {
      // Revert Optimistic Update
      setChildren(originalChildren);
      toast.error("Gagal mereset aktivitas: " + String(error));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.pin.length !== 4) {
      toast.error("PIN harus tepat 4 digit!");
      return;
    }
    setLoading(true);
    try {
      await createChildAccount(form);
      toast.success(`Akun ${form.name} berhasil dibuat! 🎉`);
      setOpen(false);
      setForm({ name: "", pin: "" });
    } catch (error) {
      toast.error(String(error));
    }
    setLoading(false);
  };

  const avatarColors = [
    "from-purple-500 to-violet-600",
    "from-blue-500 to-indigo-600",
    "from-pink-500 to-rose-600",
    "from-green-500 to-emerald-600",
    "from-amber-500 to-orange-600",
  ];

  if (isLoading && children.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64 rounded-xl" />
            <Skeleton className="h-4 w-96 rounded-xl" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-border rounded-[2.2rem] p-6 space-y-4 shadow-sm">
              <div className="flex items-center gap-4">
                <Skeleton className="w-16 h-16 rounded-2xl animate-pulse" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32 rounded animate-pulse" />
                  <Skeleton className="h-3.5 w-24 rounded animate-pulse" />
                </div>
              </div>
              <Skeleton className="h-12 w-full rounded-2xl animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-fun-dark-purple">Akun Anak 👨‍👩‍👧‍👦</h1>
          <p className="text-fun-text/60 text-sm mt-1 font-semibold">Kelola akun anak-anakmu</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button
                id="add-child-btn"
                className="bg-fun-purple hover:bg-fun-purple/90 text-white font-black rounded-xl shadow-md shadow-fun-purple/10 gap-2 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                Tambah Anak
              </Button>
            }
          />
          <DialogContent className="bg-white border-border text-fun-text rounded-[2.2rem] max-w-sm mx-auto shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-fun-dark-purple font-black text-lg text-center">Buat Akun Anak</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-fun-dark-purple font-bold">Nama Anak *</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nama panggilan anak"
                  className="bg-fun-beige border-border text-fun-dark-purple placeholder:text-fun-text/30 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-fun-dark-purple font-bold">PIN (4 digit angka) *</Label>
                <Input
                  type="text"
                  required
                  maxLength={4}
                  pattern="[0-9]{4}"
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
                  placeholder="1234"
                  className="bg-fun-beige border-border text-fun-dark-purple placeholder:text-fun-text/30 rounded-xl tracking-widest text-center text-lg font-bold"
                />
                <p className="text-fun-text/40 text-xs font-semibold">PIN ini akan digunakan anak untuk masuk ke akunnya</p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 border-border rounded-xl text-fun-text hover:bg-fun-beige font-bold">
                  Batal
                </Button>
                <Button type="submit" disabled={loading} className="flex-1 bg-fun-purple hover:bg-fun-purple/90 text-white rounded-xl font-black border-none">
                  {loading ? "Membuat..." : "Buat Akun"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {children.length === 0 ? (
        <div className="text-center py-20 bg-white border border-border rounded-[2.2rem] shadow-sm">
          <Users className="w-16 h-16 text-fun-purple/20 mx-auto mb-4" />
          <p className="text-fun-dark-purple font-black text-xl">Belum ada anak</p>
          <p className="text-fun-text/40 text-sm mt-1 font-semibold">Tambahkan akun anak pertamamu!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map((child, idx) => (
            <div
              key={child.id}
              className="bg-white border border-border rounded-[1.8rem] p-6 flex flex-col items-center text-center hover:shadow-md hover:border-fun-purple/20 transition-all shadow-sm"
            >
              <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${avatarColors[idx % avatarColors.length]} flex items-center justify-center text-white font-black text-3xl shadow-md mb-4`}>
                {child.name.charAt(0).toUpperCase()}
              </div>
              <h3 className="text-fun-dark-purple font-black text-lg">{child.name}</h3>
              <div className="flex items-center gap-2 mt-3 bg-fun-yellow/20 border border-fun-yellow/30 rounded-full px-4 py-1.5 shadow-sm">
                <Star className="w-4 h-4 text-fun-yellow fill-fun-yellow" />
                <span className="text-fun-purple font-black text-xl">{child.balance}</span>
                <span className="text-fun-purple/60 text-xs font-bold">poin</span>
              </div>
              {child.pin && (
                <p className="text-fun-text/40 text-xs mt-3 font-semibold bg-fun-beige px-3 py-1 rounded-full border border-border">PIN: {child.pin}</p>
              )}
              <p className="text-fun-text/40 text-[10px] mt-3 font-bold uppercase tracking-wider">
                Bergabung {new Date(child.created_at).toLocaleDateString("id-ID")}
              </p>

              {/* Reset Activity Button */}
              <div className="mt-4 w-full pt-4 border-t border-border/60">
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl font-bold gap-1.5 text-xs py-1.5 cursor-pointer"
                        disabled={resettingId !== null}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Aktivitas & Poin
                      </Button>
                    }
                  />
                  <AlertDialogContent className="bg-white border-border text-fun-text rounded-3xl max-w-sm mx-auto shadow-2xl p-6">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-fun-dark-purple font-black text-lg text-left">
                        Reset Aktivitas {child.name}?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-fun-text/70 mt-2 font-semibold text-left">
                        Tindakan ini akan menghapus semua riwayat transaksi/aktivitas untuk <strong className="text-fun-purple">{child.name}</strong> dan mereset poinnya menjadi <strong className="text-red-500">0</strong>.
                        <span className="block mt-2 text-fun-dark-purple font-bold">Akun profil anak tidak akan terhapus.</span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-5 flex flex-row items-center justify-end gap-2">
                      <AlertDialogCancel className="border-border rounded-xl font-bold text-fun-text hover:bg-fun-beige mt-0 cursor-pointer">
                        Batal
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleResetActivity(child.id, child.name)}
                        className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl cursor-pointer"
                      >
                        Reset
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
