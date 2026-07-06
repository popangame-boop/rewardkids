"use client";

import { useState, useEffect, useOptimistic, useTransition } from "react";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { addPunishment } from "@/app/actions/ledgers";
import { createPunishment, updatePunishment, deletePunishment } from "@/app/actions/punishments";
import { Punishment as PredefinedPunishment } from "@/types/supabase";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
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
import { Zap, Star, Clock, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, List, ShieldAlert } from "lucide-react";

type Child = { id: string; name: string };
type PunishmentHistory = {
  id: string;
  points: number;
  description: string | null;
  created_at: string;
  profiles: { name: string } | null;
};

const ICONS = ["⚡", "⚠️", "💤", "📱", "🎮", "📺", "🗑️", "📢", "😡", "❌", "👊", "🛑"];

interface PunishmentsClientProps {
  parentId: string;
  initialChildren: Child[];
  initialRecentPunishments: PunishmentHistory[];
  initialPredefinedPunishments: PredefinedPunishment[];
}

export function PunishmentsClient({
  parentId,
  initialChildren,
  initialRecentPunishments,
  initialPredefinedPunishments,
}: PunishmentsClientProps) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<"apply" | "manage">("apply");

  const { setPredefinedPunishments, predefinedPunishments } = useAppStore();

  // Sync templates in real-time
  const [templates, setTemplates, templatesLoading] = useRealtimeTable<PredefinedPunishment>("punishments", initialPredefinedPunishments);

  // Cache templates to Zustand store
  useEffect(() => {
    if (templates) {
      setPredefinedPunishments(templates);
    }
  }, [templates, setPredefinedPunishments]);

  // Sync children profiles client-side
  const { data: children = initialChildren, isLoading: childrenLoading } = useSWR<Child[]>(
    ["parentPunishmentsChildren", parentId],
    async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("role", "child")
        .eq("parent_id", parentId);
      return data || [];
    }
  );

  // Sync recent punishments client-side
  const { data: punishmentsData, mutate: mutatePunishments, isLoading: punishmentsLoading } = useSWR<PunishmentHistory[]>(
    ["parentRecentPunishments", parentId],
    async () => {
      const { data } = await supabase
        .from("ledgers")
        .select("*, profiles!ledgers_user_id_fkey(name)")
        .eq("type", "punish")
        .order("created_at", { ascending: false })
        .limit(10);
      return (data as any) || [];
    }
  );

  const [punishments, setPunishments] = useState<PunishmentHistory[]>(initialRecentPunishments);

  useEffect(() => {
    if (punishmentsData) {
      setPunishments(punishmentsData);
    }
  }, [punishmentsData]);

  // React 19 useOptimistic and useTransition for Zero-Latency punishments list update
  const [isPendingApply, startTransitionApply] = useTransition();
  const [optimisticPunishments, setOptimisticPunishments] = useOptimistic(
    punishments,
    (state, newPunishment: PunishmentHistory) => [newPunishment, ...state]
  );



  useEffect(() => {
    const fetchRecentPunishment = async (id: string): Promise<PunishmentHistory | null> => {
      const { data, error } = await supabase
        .from("ledgers")
        .select("id, points, description, created_at, profiles!ledgers_user_id_fkey(name)")
        .eq("id", id)
        .single();
      if (error || !data) return null;
      const profiles = Array.isArray((data as any).profiles) ? (data as any).profiles[0] : (data as any).profiles;
      return {
        id: data.id,
        points: data.points,
        description: data.description,
        created_at: data.created_at,
        profiles: profiles ? { name: profiles.name } : null,
      } as PunishmentHistory;
    };

    const channel = supabase
      .channel("parent-punishments-history")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ledgers",
          filter: "type=eq.punish",
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const fullHistory = await fetchRecentPunishment(payload.new.id);
            if (fullHistory) {
              setPunishments((prev) => [fullHistory, ...prev]);
            }
          } else if (payload.eventType === "UPDATE") {
            const fullHistory = await fetchRecentPunishment(payload.new.id);
            if (fullHistory) {
              setPunishments((prev) =>
                prev.map((p) => (p.id === fullHistory.id ? fullHistory : p))
              );
            }
          } else if (payload.eventType === "DELETE") {
            const oldId = payload.old.id;
            setPunishments((prev) => prev.filter((p) => p.id !== oldId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Apply Punishment Form State
  const [selectedChild, setSelectedChild] = useState("");
  const [points, setPoints] = useState(5);
  const [reason, setReason] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [loadingApply, setLoadingApply] = useState(false);

  // Manage templates state
  const [openTemplateDialog, setOpenTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PredefinedPunishment | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    title: "",
    description: "",
    point_penalty: 5,
    icon: "⚡",
  });

  const resetTemplateForm = () => {
    setTemplateForm({ title: "", description: "", point_penalty: 5, icon: "⚡" });
    setEditingTemplate(null);
  };

  const openEditTemplate = (template: PredefinedPunishment) => {
    setEditingTemplate(template);
    setTemplateForm({
      title: template.title,
      description: template.description ?? "",
      point_penalty: template.point_penalty,
      icon: template.icon,
    });
    setOpenTemplateDialog(true);
  };

  // Submit template creation/modification
  const handleTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const originalTemplates = templates;
    const isEditing = !!editingTemplate;
    const tId = editingTemplate?.id;
    const tempForm = { ...templateForm };

    if (isEditing && tId) {
      // Optimistic Update: instantly update template in list and close dialog
      setTemplates((prev) =>
        prev.map((t) => (t.id === tId ? { ...t, ...tempForm } : t))
      );
      setOpenTemplateDialog(false);
      resetTemplateForm();
      toast.success("Template punishment berhasil diperbarui!");

      try {
        await updatePunishment(tId, tempForm);
      } catch (error) {
        // Revert Optimistic Update
        setTemplates(originalTemplates);
        toast.error("Gagal memperbarui template punishment: " + String(error));
      }
    } else {
      setLoadingTemplate(true);
      try {
        await createPunishment(templateForm);
        toast.success("Template punishment berhasil dibuat! ⚡");
        setOpenTemplateDialog(false);
        resetTemplateForm();
      } catch (error) {
        toast.error(String(error));
      }
      setLoadingTemplate(false);
    }
  };

  const handleToggleTemplate = async (template: PredefinedPunishment) => {
    const originalTemplates = templates;
    const targetStatus = !template.is_active;

    // Optimistic Update: toggle immediately
    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, is_active: targetStatus } : t))
    );
    toast.success(targetStatus ? "Template diaktifkan!" : "Template dinonaktifkan");

    try {
      await updatePunishment(template.id, { is_active: targetStatus });
    } catch (error) {
      // Revert Optimistic Update
      setTemplates(originalTemplates);
      toast.error("Gagal mengubah status template: " + String(error));
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    await deleteTemplate(id);
  };

  const deleteTemplate = async (id: string) => {
    const originalTemplates = templates;

    // Optimistic Update: remove immediately
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success("Template punishment dihapus");

    try {
      await deletePunishment(id);
    } catch (error) {
      // Revert Optimistic Update
      setTemplates(originalTemplates);
      toast.error("Gagal menghapus template punishment: " + String(error));
    }
  };

  // Select a template for applying punishment
  const handleSelectTemplate = (template: PredefinedPunishment) => {
    if (selectedTemplateId === template.id) {
      // Deselect
      setSelectedTemplateId(null);
      setPoints(5);
      setReason("");
    } else {
      setSelectedTemplateId(template.id);
      setPoints(template.point_penalty);
      setReason(template.title);
    }
  };

  // Apply Punishment
  const handleSubmitApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild) {
      toast.error("Pilih anak terlebih dahulu");
      return;
    }
    const childId = selectedChild;
    const penaltyPoints = points;
    const penaltyReason = reason;
    const templateId = selectedTemplateId;
    const childName = children.find((c) => c.id === childId)?.name;

    // Reset form and show success toast immediately
    setReason("");
    setPoints(5);
    setSelectedTemplateId(null);
    toast.success(`Punishment diberikan kepada ${childName} ⚡`);

    startTransitionApply(async () => {
      setOptimisticPunishments({
        id: `temp-${Date.now()}`,
        points: penaltyPoints,
        description: penaltyReason,
        created_at: new Date().toISOString(),
        profiles: { name: childName ?? "" },
      });
      try {
        await addPunishment(childId, penaltyPoints, penaltyReason, templateId || undefined);
        await mutatePunishments();
      } catch (error) {
        toast.error("Gagal memberikan punishment: " + String(error));
      }
    });
  };

  const hasCachedTemplates = predefinedPunishments !== null;
  const isCurrentlyLoading = (childrenLoading && children.length === 0) || (punishmentsLoading && punishments.length === 0) || (!hasCachedTemplates && templatesLoading && templates.length === 0);

  if (isCurrentlyLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 rounded-xl" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-[2.2rem]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-fun-dark-purple">Punishment ⚡</h1>
          <p className="text-fun-text/60 text-sm mt-1 font-semibold">Kurangi poin anak sebagai konsekuensi tindakan</p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-fun-beige p-1 rounded-2xl border border-border self-start md:self-auto shadow-sm">
          <button
            onClick={() => setActiveTab("apply")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "apply"
                ? "bg-white text-fun-dark-purple shadow-sm"
                : "text-fun-text/60 hover:text-fun-dark-purple"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Beri Punishment
          </button>
          <button
            onClick={() => setActiveTab("manage")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "manage"
                ? "bg-white text-fun-dark-purple shadow-sm"
                : "text-fun-text/60 hover:text-fun-dark-purple"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Kelola List
          </button>
        </div>
      </div>

      {activeTab === "apply" ? (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Main Workspace Left Side: templates & form */}
          <div className="lg:col-span-8 space-y-6">
            {/* Quick Templates List */}
            <div className="bg-white border border-border rounded-[1.8rem] p-6 shadow-sm">
              <h2 className="text-fun-dark-purple font-black text-lg mb-4 flex items-center gap-2">
                <List className="w-5 h-5 text-fun-pink" />
                Pilih dari Daftar Hukuman
              </h2>

              {templates.filter((t) => t.is_active).length === 0 ? (
                <div className="text-center py-8 bg-fun-beige/20 rounded-2xl border border-dashed border-border/80">
                  <ShieldAlert className="w-8 h-8 text-fun-purple/20 mx-auto mb-2" />
                  <p className="text-fun-text/40 text-sm font-semibold">Belum ada daftar punishment aktif</p>
                  <button
                    onClick={() => setActiveTab("manage")}
                    className="mt-2 text-xs font-black text-fun-purple hover:underline"
                  >
                    Buat Daftar Baru &rarr;
                  </button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  { (predefinedPunishments || templates)
                    .filter((t) => t.is_active)
                    .map((template) => {
                      const isSelected = selectedTemplateId === template.id;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => handleSelectTemplate(template)}
                          className={`p-4 rounded-[1.4rem] border text-left transition-all cursor-pointer flex items-start gap-3 relative overflow-hidden group ${
                            isSelected
                              ? "bg-fun-pink/10 border-fun-pink shadow-md"
                              : "bg-white border-border hover:border-fun-pink/40 hover:bg-fun-pink/5"
                          }`}
                        >
                          <span className="text-2xl bg-fun-beige w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            {template.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-fun-dark-purple font-black text-sm truncate">{template.title}</p>
                            {template.description && (
                              <p className="text-fun-text/60 text-xs mt-0.5 line-clamp-1 font-semibold">
                                {template.description}
                              </p>
                            )}
                            <div className="flex items-center gap-1 mt-2 text-xs font-black text-fun-pink">
                              <Star className="w-3.5 h-3.5 fill-fun-pink" />
                              -{template.point_penalty} Poin
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-0 right-0 bg-fun-pink text-white px-2 py-0.5 text-[9px] font-black rounded-bl-lg uppercase tracking-wider">
                              Dipilih
                            </div>
                          )}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Custom Form details */}
            <div className="bg-white border border-border rounded-[1.8rem] p-6 space-y-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-fun-pink flex items-center justify-center shadow-md shadow-fun-pink/20">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-fun-dark-purple font-black text-sm">Detail Konsekuensi</h2>
                    <p className="text-fun-text/40 text-xs font-semibold">
                      {selectedTemplateId ? "Menggunakan template terpilih (bisa diubah manual)" : "Pengurangan poin langsung diterapkan"}
                    </p>
                  </div>
                </div>

                {selectedTemplateId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setSelectedTemplateId(null);
                      setPoints(5);
                      setReason("");
                    }}
                    className="text-fun-text/40 hover:text-fun-pink text-xs font-bold rounded-lg border-none"
                  >
                    Reset Pilihan
                  </Button>
                )}
              </div>

              <form onSubmit={handleSubmitApply} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-fun-dark-purple font-bold">Pilih Anak *</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {children.length === 0 ? (
                      <p className="text-fun-text/40 text-sm col-span-2 font-semibold">Belum ada akun anak</p>
                    ) : (
                      children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => setSelectedChild(child.id)}
                          className={`p-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                            selectedChild === child.id
                              ? "bg-fun-pink border-fun-pink text-white shadow-md shadow-fun-pink/15"
                              : "bg-fun-beige border-border text-fun-text/60 hover:bg-fun-pink/5 hover:text-fun-pink hover:border-fun-pink/30"
                          }`}
                        >
                          {child.name}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-fun-dark-purple font-bold">Jumlah Bintang Dikurangi *</Label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPoints(Math.max(1, points - 1));
                        setSelectedTemplateId(null); // Mark as custom if modified
                      }}
                      className="w-10 h-10 rounded-xl bg-fun-beige text-fun-dark-purple font-bold hover:bg-fun-purple/10 border border-border transition-colors text-xl cursor-pointer"
                    >
                      −
                    </button>
                    <div className="flex-1 bg-fun-beige rounded-xl h-12 flex items-center justify-center gap-2 border border-border">
                      <Star className="w-5 h-5 text-fun-pink fill-fun-pink" />
                      <span className="text-fun-dark-purple font-black text-2xl">{points}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPoints(points + 1);
                        setSelectedTemplateId(null); // Mark as custom if modified
                      }}
                      className="w-10 h-10 rounded-xl bg-fun-beige text-fun-dark-purple font-bold hover:bg-fun-purple/10 border border-border transition-colors text-xl cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  {/* Quick select */}
                  <div className="flex gap-2">
                    {[5, 10, 20, 50].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setPoints(p);
                          setSelectedTemplateId(null); // Mark as custom if modified
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          points === p ? "bg-fun-pink text-white shadow-sm" : "bg-fun-beige text-fun-text/60 hover:bg-fun-pink/5 hover:text-fun-pink"
                        } border border-border/80`}
                      >
                        -{p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-fun-dark-purple font-bold">Alasan *</Label>
                  <Textarea
                    required
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setSelectedTemplateId(null); // Mark as custom if modified
                    }}
                    placeholder="Contoh: Tidak membereskan mainan setelah bermain"
                    className="bg-fun-beige border-border text-fun-dark-purple placeholder:text-fun-text/30 rounded-md resize-none font-semibold"
                    rows={3}
                  />
                </div>

                <Button
                  id="give-punishment-btn"
                  type="submit"
                  disabled={isPendingApply || !selectedChild}
                  className="w-full bg-fun-pink hover:bg-fun-pink/90 text-white font-black rounded-xl h-12 shadow-lg shadow-fun-pink/15 gap-2 border-none cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  {isPendingApply ? "Menerapkan..." : "Berikan Punishment"}
                </Button>
              </form>
            </div>
          </div>

          {/* Right Side: Recent list history */}
          <div className="lg:col-span-4 bg-white border border-border rounded-[1.8rem] p-6 shadow-sm flex flex-col h-fit">
            <h2 className="text-fun-dark-purple font-black text-lg mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-fun-purple" />
              Riwayat Hukuman
            </h2>
            {optimisticPunishments.length === 0 ? (
              <div className="text-center py-20 flex-1 flex flex-col items-center justify-center border border-dashed border-border/80 rounded-2xl">
                <Zap className="w-10 h-10 text-fun-purple/20 mx-auto mb-2 animate-bounce" />
                <p className="text-fun-text/40 text-sm font-semibold">Belum ada punishment</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {optimisticPunishments.map((p) => (
                  <div key={p.id} className="bg-fun-beige/50 border border-border/60 rounded-2xl p-4 flex items-start gap-3 shadow-none">
                    <div className="w-8 h-8 rounded-lg bg-fun-pink/10 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-4 h-4 text-fun-pink" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-fun-dark-purple text-sm font-black truncate">
                        {p.profiles?.name} • <span className="text-fun-pink">-{p.points} poin</span>
                      </p>
                      <p className="text-fun-text/60 text-xs mt-0.5 line-clamp-2 font-semibold leading-relaxed">{p.description}</p>
                      <div className="flex items-center gap-1.5 text-fun-text/40 text-[10px] mt-1.5 font-black uppercase tracking-wider">
                        <Clock className="w-3 h-3" />
                        {new Date(p.created_at).toLocaleDateString("id-ID", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Manage templates view */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-fun-dark-purple font-black text-lg">Daftar Punishment Standar</h2>
              <p className="text-fun-text/60 text-xs font-semibold">Buat daftar hukuman tetap yang sering digunakan</p>
            </div>
            <Dialog open={openTemplateDialog} onOpenChange={(v) => { setOpenTemplateDialog(v); if (!v) resetTemplateForm(); }}>
              <DialogTrigger
                render={
                  <Button id="add-punishment-template-btn" className="bg-fun-purple hover:bg-fun-purple/90 text-white font-black rounded-xl shadow-md gap-2 cursor-pointer">
                    <Plus className="w-4 h-4" />
                    Tambah Hukuman
                  </Button>
                }
              />
              <DialogContent className="bg-white border-border text-fun-text rounded-[2.2rem] max-w-md mx-auto shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-fun-dark-purple font-black text-lg text-center">
                    {editingTemplate ? "Edit Hukuman Standar" : "Buat Hukuman Standar Baru"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleTemplateSubmit} className="space-y-4 pt-2">
                  {/* Icon selector */}
                  <div className="space-y-2">
                    <Label className="text-fun-dark-purple font-bold">Ikon Hukuman</Label>
                    <div className="flex flex-wrap gap-2">
                      {ICONS.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => setTemplateForm({ ...templateForm, icon })}
                          className={`w-9 h-9 rounded-xl text-xl transition-all cursor-pointer ${
                            templateForm.icon === icon
                              ? "bg-fun-pink text-white scale-110 shadow-md"
                              : "bg-fun-beige hover:bg-fun-pink/10 text-fun-text"
                          }`}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-fun-dark-purple font-bold">Nama Hukuman / Judul *</Label>
                    <Input
                      required
                      value={templateForm.title}
                      onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                      placeholder="Contoh: Terlambat bangun tidur"
                      className="bg-fun-beige border-border text-fun-dark-purple placeholder:text-fun-text/30 rounded-md"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-fun-dark-purple font-bold">Deskripsi / Penjelasan</Label>
                    <Textarea
                      value={templateForm.description}
                      onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                      placeholder="Contoh: Bangun lebih dari pukul 06:30 pagi tanpa alasan sakit..."
                      className="bg-fun-beige border-border text-fun-dark-purple placeholder:text-fun-text/30 rounded-md resize-none"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-fun-dark-purple font-bold">Poin Dihukum / Pengurangan Poin *</Label>
                    <Input
                      type="number"
                      min={1}
                      required
                      value={templateForm.point_penalty}
                      onChange={(e) => setTemplateForm({ ...templateForm, point_penalty: parseInt(e.target.value) })}
                      className="bg-fun-beige border-border text-fun-dark-purple rounded-md font-bold"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setOpenTemplateDialog(false)} className="flex-1 border-border text-fun-text rounded-xl font-bold hover:bg-fun-beige cursor-pointer">
                      Batal
                    </Button>
                    <Button type="submit" disabled={loadingTemplate} className="flex-1 bg-fun-purple hover:bg-fun-purple/90 text-white rounded-xl font-black border-none cursor-pointer">
                      {loadingTemplate ? "Menyimpan..." : editingTemplate ? "Simpan" : "Buat Hukuman"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {templates.length === 0 ? (
            <div className="text-center py-20 bg-white border border-border rounded-[2.2rem] shadow-sm">
              <div className="text-6xl mb-4">⚡</div>
              <p className="text-fun-dark-purple font-black text-xl">Belum ada daftar punishment</p>
              <p className="text-fun-text/40 text-sm mt-1 font-semibold font-semibold">Buat daftar punishment pertama untuk mempermudah pemberian konsekuensi!</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`relative bg-white border rounded-[1.8rem] p-5 transition-all shadow-sm ${
                    template.is_active ? "border-border hover:shadow-md" : "border-border opacity-60 bg-fun-beige/50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl bg-fun-beige w-12 h-12 rounded-2xl flex items-center justify-center">
                        {template.icon}
                      </span>
                      <div>
                        <p className="text-fun-dark-purple font-black text-sm leading-tight">{template.title}</p>
                      </div>
                    </div>
                  </div>

                  {template.description && (
                    <p className="text-fun-text/60 text-xs mb-4 line-clamp-2 font-semibold leading-relaxed">
                      {template.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between border-t border-border/60 pt-3">
                    <div className="flex items-center gap-1 bg-fun-pink/10 border border-fun-pink/20 rounded-full px-2.5 py-1">
                      <Star className="w-3.5 h-3.5 text-fun-pink fill-fun-pink" />
                      <span className="text-fun-pink font-black text-xs">-{template.point_penalty} Poin</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleTemplate(template)}
                        className="text-fun-text/40 hover:text-fun-purple p-1.5 rounded-lg hover:bg-fun-purple/5 transition-colors cursor-pointer"
                      >
                        {template.is_active ? (
                          <ToggleRight className="w-6 h-6 text-fun-teal" />
                        ) : (
                          <ToggleLeft className="w-6 h-6" />
                        )}
                      </button>
                      <button
                        onClick={() => openEditTemplate(template)}
                        className="text-fun-text/40 hover:text-fun-purple p-1.5 rounded-lg hover:bg-fun-purple/5 transition-colors cursor-pointer"
                      >
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
                            <AlertDialogTitle className="text-fun-dark-purple font-black text-center text-lg">
                              Hapus Hukuman? ⚡
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-center font-semibold">
                              Hukuman &quot;{template.title}&quot; akan dihapus permanen dari daftar.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex gap-2 sm:flex-row pt-2">
                            <AlertDialogCancel className="flex-1 border-border text-fun-text hover:bg-fun-beige rounded-xl font-bold">
                              Batal
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteTemplate(template.id)}
                              className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black border-none"
                            >
                              Hapus
                            </AlertDialogAction>
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
      )}
    </div>
  );
}
