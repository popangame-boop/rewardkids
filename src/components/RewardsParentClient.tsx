"use client";

import { useState } from "react";
import { Reward } from "@/types/supabase";
import { createReward, updateReward, deleteReward } from "@/app/actions/rewards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Trash2, Star, Gift, Package, ToggleLeft, ToggleRight } from "lucide-react";

interface RewardsParentClientProps {
  initialRewards: Reward[];
}

export function RewardsParentClient({ initialRewards }: RewardsParentClientProps) {
  const [rewards, setRewards] = useState(initialRewards);
  const [open, setOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    point_cost: 50,
    stock: -1,
    image_url: "",
  });

  const resetForm = () => {
    setForm({ title: "", description: "", point_cost: 50, stock: -1, image_url: "" });
    setEditingReward(null);
  };

  const openEdit = (reward: Reward) => {
    setEditingReward(reward);
    setForm({
      title: reward.title,
      description: reward.description ?? "",
      point_cost: reward.point_cost,
      stock: reward.stock,
      image_url: reward.image_url ?? "",
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, image_url: form.image_url || null };
      if (editingReward) {
        await updateReward(editingReward.id, payload);
        toast.success("Hadiah berhasil diperbarui!");
        setRewards(rewards.map((r) => (r.id === editingReward.id ? { ...r, ...payload } as Reward : r)));
      } else {
        await createReward(payload);
        toast.success("Hadiah berhasil ditambahkan! 🎁");
        window.location.reload();
      }
      setOpen(false);
      resetForm();
    } catch (error) {
      toast.error(String(error));
    }
    setLoading(false);
  };

  const handleToggle = async (reward: Reward) => {
    try {
      await updateReward(reward.id, { is_active: !reward.is_active });
      setRewards(rewards.map((r) => (r.id === reward.id ? { ...r, is_active: !r.is_active } : r)));
      toast.success(reward.is_active ? "Hadiah dinonaktifkan" : "Hadiah diaktifkan!");
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReward(id);
      setRewards(rewards.filter((r) => r.id !== id));
      toast.success("Hadiah dihapus");
    } catch (error) {
      toast.error(String(error));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-fun-dark-purple">Katalog Hadiah 🎁</h1>
          <p className="text-fun-text/60 text-sm mt-1 font-semibold">Kelola hadiah yang bisa ditukar anak</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger
            render={
              <Button id="add-reward-btn" className="bg-fun-purple hover:bg-fun-purple/90 text-white font-black rounded-xl shadow-md shadow-fun-purple/10 gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" /> Tambah Hadiah
              </Button>
            }
          />
          <DialogContent className="bg-white border-border text-fun-text rounded-[2.2rem] max-w-md mx-auto shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-fun-dark-purple font-black text-lg text-center">
                {editingReward ? "Edit Hadiah" : "Tambah Hadiah"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-fun-dark-purple font-bold">Nama Hadiah *</Label>
                <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Contoh: Nonton Film Pilihan" className="bg-fun-beige border-border text-fun-dark-purple placeholder:text-fun-text/30 rounded-md" />
              </div>
              <div className="space-y-2">
                <Label className="text-fun-dark-purple font-bold">Deskripsi</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detail hadiah..." className="bg-fun-beige border-border text-fun-dark-purple placeholder:text-fun-text/30 rounded-md resize-none" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-fun-dark-purple font-bold">Biaya Poin *</Label>
                  <Input type="number" min={1} required value={form.point_cost}
                    onChange={(e) => setForm({ ...form, point_cost: parseInt(e.target.value) })}
                    className="bg-fun-beige border-border text-fun-dark-purple rounded-md font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-fun-dark-purple font-bold">Stok (-1 = ∞)</Label>
                  <Input type="number" min={-1} value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) })}
                    className="bg-fun-beige border-border text-fun-dark-purple rounded-md font-bold" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-fun-dark-purple font-bold">URL Gambar (opsional)</Label>
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://..." className="bg-fun-beige border-border text-fun-dark-purple placeholder:text-fun-text/30 rounded-md" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 border-border text-fun-text rounded-xl font-bold hover:bg-fun-beige">Batal</Button>
                <Button type="submit" disabled={loading} className="flex-1 bg-fun-purple hover:bg-fun-purple/90 text-white rounded-xl font-black border-none">
                  {loading ? "Menyimpan..." : editingReward ? "Simpan" : "Tambah"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {rewards.length === 0 ? (
        <div className="text-center py-20 bg-white border border-border rounded-[2.2rem] shadow-sm">
          <div className="text-6xl mb-4">🎁</div>
          <p className="text-fun-dark-purple font-black text-xl">Belum ada hadiah</p>
          <p className="text-fun-text/40 text-sm mt-1 font-semibold">Buat hadiah pertama untuk anak-anakmu!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rewards.map((reward) => (
            <div key={reward.id} className={`relative bg-white border rounded-[1.8rem] overflow-hidden transition-all shadow-sm ${reward.is_active ? "border-border hover:shadow-md" : "border-border opacity-65 bg-fun-beige/50"}`}>
              {/* Image */}
              <div className="h-32 bg-fun-beige flex items-center justify-center relative">
                {reward.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={reward.image_url} alt={reward.title} className="w-full h-full object-cover" />
                ) : (
                  <Gift className="w-12 h-12 text-fun-purple/20" />
                )}
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-fun-dark-purple font-black text-sm leading-tight">{reward.title}</p>
                  {reward.description && (
                    <p className="text-fun-text/60 text-xs mt-1 line-clamp-2 font-medium">{reward.description}</p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-fun-yellow/20 border border-fun-yellow/30 rounded-full px-2.5 py-1">
                    <Star className="w-3.5 h-3.5 text-fun-yellow fill-fun-yellow" />
                    <span className="text-fun-purple font-black text-xs">{reward.point_cost}</span>
                  </div>
                  <div className="flex items-center gap-1 text-fun-text/40 text-xs font-bold">
                    <Package className="w-3.5 h-3.5" />
                    {reward.stock === -1 ? "∞" : reward.stock}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 border-t border-border pt-2">
                  <button onClick={() => handleToggle(reward)} className="p-1.5 rounded-lg hover:bg-fun-purple/5 transition-colors cursor-pointer text-fun-text/40 hover:text-fun-purple">
                    {reward.is_active ? <ToggleRight className="w-6 h-6 text-fun-teal" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                  <button onClick={() => openEdit(reward)} className="p-1.5 text-fun-text/40 hover:text-fun-purple rounded-lg hover:bg-fun-purple/5 transition-colors cursor-pointer">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <button className="p-1.5 text-red-500/60 hover:text-red-500 rounded-lg hover:bg-red-500/5 transition-colors cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      }
                    />
                    <AlertDialogContent className="bg-white border-border text-fun-text rounded-[2.2rem] max-w-sm mx-auto shadow-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-fun-dark-purple font-black text-center text-lg">Hapus Hadiah? 🎁</AlertDialogTitle>
                        <AlertDialogDescription className="text-center font-medium">
                          Hadiah &quot;{reward.title}&quot; akan dihapus permanen dari katalog.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex gap-2 sm:flex-row pt-2">
                        <AlertDialogCancel className="flex-1 border-border text-fun-text hover:bg-fun-beige rounded-xl font-bold">Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(reward.id)} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black border-none">Hapus</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
