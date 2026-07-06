"use client";

import { useState } from "react";
import { Mission } from "@/types/supabase";
import { createMission, updateMission, deleteMission } from "@/app/actions/missions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
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
import { Plus, Pencil, Trash2, Star, ToggleLeft, ToggleRight } from "lucide-react";

const ICONS = ["⭐", "🏆", "🎯", "📚", "🧹", "🙏", "🏃", "🎨", "🍳", "🌱", "💪", "🎵"];
const CATEGORIES = ["Kebersihan", "Ibadah", "Sekolah", "Olahraga", "Sosial", "Kreativitas", "Lainnya"];

interface MissionsClientProps {
  initialMissions: Mission[];
}

export function MissionsClient({ initialMissions }: MissionsClientProps) {
  const [missions, setMissions] = useRealtimeTable<Mission>("missions", initialMissions);
  const [open, setOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    point_reward: 10,
    icon: "⭐",
  });

  const resetForm = () => {
    setForm({ title: "", description: "", category: "", point_reward: 10, icon: "⭐" });
    setEditingMission(null);
  };

  const openEdit = (mission: Mission) => {
    setEditingMission(mission);
    setForm({
      title: mission.title,
      description: mission.description ?? "",
      category: mission.category ?? "",
      point_reward: mission.point_reward,
      icon: mission.icon,
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const originalMissions = missions;
    const isEditing = !!editingMission;
    const mId = editingMission?.id;
    const tempForm = { ...form };

    if (isEditing && mId) {
      // Optimistic Update for Edit: instantly update list item and close dialog
      setMissions((prev) =>
        prev.map((m) => (m.id === mId ? { ...m, ...tempForm } : m))
      );
      setOpen(false);
      resetForm();
      toast.success("Misi berhasil diperbarui!");

      try {
        await updateMission(mId, tempForm);
      } catch (error) {
        // Revert Optimistic Update
        setMissions(originalMissions);
        toast.error("Gagal memperbarui misi: " + String(error));
      }
    } else {
      // Create operates with normal loading flow
      setLoading(true);
      try {
        await createMission(form);
        toast.success("Misi berhasil dibuat! 🎯");
        setOpen(false);
        resetForm();
      } catch (error) {
        toast.error(String(error));
      }
      setLoading(false);
    }
  };

  const handleToggle = async (mission: Mission) => {
    const originalMissions = missions;
    const targetStatus = !mission.is_active;

    // Optimistic Update: toggle status instantly
    setMissions((prev) =>
      prev.map((m) => (m.id === mission.id ? { ...m, is_active: targetStatus } : m))
    );
    toast.success(targetStatus ? "Misi diaktifkan!" : "Misi dinonaktifkan");

    try {
      await updateMission(mission.id, { is_active: targetStatus });
    } catch (error) {
      // Revert Optimistic Update
      setMissions(originalMissions);
      toast.error("Gagal mengubah status misi: " + String(error));
    }
  };

  const handleDelete = async (id: string) => {
    const originalMissions = missions;

    // Optimistic Update: filter out deleted item immediately
    setMissions((prev) => prev.filter((m) => m.id !== id));
    toast.success("Misi dihapus");

    try {
      await deleteMission(id);
    } catch (error) {
      // Revert Optimistic Update
      setMissions(originalMissions);
      toast.error("Gagal menghapus misi: " + String(error));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-fun-dark-purple">Manajemen Misi 🎯</h1>
          <p className="text-fun-text/60 text-sm mt-1 font-semibold">Buat dan kelola misi untuk anak-anakmu</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger
            render={
              <Button id="add-mission-btn" className="bg-fun-purple hover:bg-fun-purple/90 text-white font-black rounded-xl shadow-md shadow-fun-purple/10 gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                Tambah Misi
              </Button>
            }
          />
          <DialogContent className="bg-white border-border text-fun-text rounded-[2.2rem] max-w-md mx-auto shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-fun-dark-purple font-black text-lg text-center">
                {editingMission ? "Edit Misi" : "Buat Misi Baru"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              {/* Icon picker */}
              <div className="space-y-2">
                <Label className="text-fun-dark-purple font-bold">Ikon Misi</Label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setForm({ ...form, icon })}
                      className={`w-9 h-9 rounded-xl text-xl transition-all cursor-pointer ${form.icon === icon ? "bg-fun-purple text-white scale-110 shadow-md" : "bg-fun-beige hover:bg-fun-purple/10 text-fun-text"}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-fun-dark-purple font-bold">Judul Misi *</Label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Contoh: Merapikan tempat tidur"
                  className="bg-fun-beige border-border text-fun-dark-purple placeholder:text-fun-text/30 rounded-md"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-fun-dark-purple font-bold">Deskripsi</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Contoh: Bersihkan kasur, lipat selimut..."
                  className="bg-fun-beige border-border text-fun-dark-purple placeholder:text-fun-text/30 rounded-md resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-fun-dark-purple font-bold">Kategori</Label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-fun-beige border border-border text-fun-dark-purple rounded-md px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-fun-purple"
                  >
                    <option value="" className="bg-white">Pilih kategori</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-white">{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-fun-dark-purple font-bold">Poin Reward *</Label>
                  <Input
                    type="number"
                    min={1}
                    required
                    value={form.point_reward}
                    onChange={(e) => setForm({ ...form, point_reward: parseInt(e.target.value) })}
                    className="bg-fun-beige border-border text-fun-dark-purple rounded-md font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 border-border text-fun-text rounded-xl font-bold hover:bg-fun-beige">
                  Batal
                </Button>
                <Button type="submit" disabled={loading} className="flex-1 bg-fun-purple hover:bg-fun-purple/90 text-white rounded-xl font-black border-none">
                  {loading ? "Menyimpan..." : editingMission ? "Simpan" : "Buat Misi"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Missions Grid */}
      {missions.length === 0 ? (
        <div className="text-center py-20 bg-white border border-border rounded-[2.2rem] shadow-sm">
          <div className="text-6xl mb-4">🎯</div>
          <p className="text-fun-dark-purple font-black text-xl">Belum ada misi</p>
          <p className="text-fun-text/40 text-sm mt-1 font-semibold">Buat misi pertama untuk anak-anakmu!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {missions.map((mission) => (
            <div
              key={mission.id}
              className={`relative bg-white border rounded-[1.8rem] p-5 transition-all shadow-sm ${mission.is_active ? "border-border hover:shadow-md" : "border-border opacity-65 bg-fun-beige/50"}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl bg-fun-beige w-12 h-12 rounded-2xl flex items-center justify-center">{mission.icon}</span>
                  <div>
                    <p className="text-fun-dark-purple font-black text-sm leading-tight">{mission.title}</p>
                    {mission.category && (
                      <Badge className="mt-1 text-[10px] font-black uppercase tracking-wider bg-fun-purple/10 text-fun-purple border-fun-purple/20 rounded-full px-2 py-0.5 shadow-none">
                        {mission.category}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {mission.description && (
                <p className="text-fun-text/60 text-xs mb-4 line-clamp-2 font-medium">{mission.description}</p>
              )}

              <div className="flex items-center justify-between border-t border-border/60 pt-3">
                <div className="flex items-center gap-1 bg-fun-yellow/20 border border-fun-yellow/30 rounded-full px-2.5 py-1">
                  <Star className="w-3.5 h-3.5 text-fun-yellow fill-fun-yellow" />
                  <span className="text-fun-purple font-black text-xs">+{mission.point_reward}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button onClick={() => handleToggle(mission)} className="text-fun-text/40 hover:text-fun-purple p-1.5 rounded-lg hover:bg-fun-purple/5 transition-colors cursor-pointer">
                    {mission.is_active ? <ToggleRight className="w-6 h-6 text-fun-teal" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                  <button onClick={() => openEdit(mission)} className="text-fun-text/40 hover:text-fun-purple p-1.5 rounded-lg hover:bg-fun-purple/5 transition-colors cursor-pointer">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <button className="text-red-500/60 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-500/5 transition-colors cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      }
                    />
                    <AlertDialogContent className="bg-white border-border text-fun-text rounded-[2.2rem] max-w-sm mx-auto shadow-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-fun-dark-purple font-black text-center text-lg">Hapus Misi? 🎯</AlertDialogTitle>
                        <AlertDialogDescription className="text-center font-medium">
                          Misi &quot;{mission.title}&quot; akan dihapus permanen dari sistem.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex gap-2 sm:flex-row pt-2">
                        <AlertDialogCancel className="flex-1 border-border text-fun-text hover:bg-fun-beige rounded-xl font-bold">Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(mission.id)} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black border-none">Hapus</AlertDialogAction>
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
