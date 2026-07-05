"use client";

import { useState, useRef } from "react";
import { Mission } from "@/types/supabase";
import { submitMissionProof } from "@/app/actions/ledgers";
import { createClient } from "@/lib/supabase/client";
import { compressToWebP } from "@/lib/imageCompressor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera, Star, Upload, CheckCircle, Loader2, Clock } from "lucide-react";
import Image from "next/image";

interface ChildMissionsClientProps {
  missions: Mission[];
  pendingMissionIds: Set<string | null>;
  childId: string;
}

export function ChildMissionsClient({ missions, pendingMissionIds, childId }: ChildMissionsClientProps) {
  const supabase = createClient();
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = [...new Set(missions.map((m) => m.category ?? "Umum"))];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const newFiles = [...files, ...selectedFiles].slice(0, 5);
    setFiles(newFiles);

    // Revoke old URLs
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    const urls = newFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);

    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    const urls = newFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
  };

  const handleSubmit = async () => {
    if (!selectedMission) return;
    setLoading(true);

    const urls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const originalFile = files[i];
        
        // Compress to WebP
        const compressed = await compressToWebP(originalFile, 0.8, 1200, 1200);

        // Path: uses childId and timestamp + index to ensure uniqueness
        const path = `${childId}/${selectedMission.id}-${Date.now()}-${i}.webp`;
        const { error: uploadError } = await supabase.storage
          .from("proofs")
          .upload(path, compressed, { upsert: true });

        if (uploadError) {
          throw new Error("Gagal upload foto ke-" + (i + 1) + ": " + uploadError.message);
        }

        const { data: urlData } = supabase.storage.from("proofs").getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }

      await submitMissionProof(selectedMission.id, urls[0] || "", urls);
      toast.success("Misi berhasil dilaporkan! Tunggu konfirmasi orang tua 🎉");
      setSelectedMission(null);
      setFiles([]);
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setPreviewUrls([]);
      window.location.reload();
    } catch (error) {
      toast.error(String(error));
    }
    setLoading(false);
  };

  return (
    <div className="px-4 pt-6 pb-2 space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-black text-fun-dark-purple">Misi Tersedia 🎯</h1>
        <p className="text-fun-text/60 text-sm mt-1 font-medium">Selesaikan misi dan kumpulkan bintang!</p>
      </div>

      {missions.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-border shadow-sm">
          <div className="text-6xl mb-4">🎯</div>
          <p className="text-fun-dark-purple font-extrabold">Belum ada misi</p>
          <p className="text-fun-text/40 text-sm font-semibold">Orang tua belum menambahkan misi</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const catMissions = missions.filter((m) => (m.category ?? "Umum") === cat);
            return (
              <div key={cat} className="space-y-3">
                <h2 className="text-fun-purple font-black text-xs uppercase tracking-wider pl-1">{cat}</h2>
                <div className="space-y-3">
                  {catMissions.map((mission) => {
                    const isPending = pendingMissionIds.has(mission.id);
                    return (
                      <div
                        key={mission.id}
                        onClick={() => !isPending && setSelectedMission(mission)}
                        className={`relative bg-white border rounded-[1.8rem] p-4 flex items-center gap-4 transition-all ${
                          isPending
                            ? "border-fun-yellow/40 opacity-75 cursor-not-allowed shadow-sm"
                            : "border-border hover:border-fun-purple/30 hover:shadow-md active:scale-[0.98] cursor-pointer"
                        }`}
                      >
                        <div className="w-14 h-14 rounded-2xl bg-fun-beige flex items-center justify-center text-3xl flex-shrink-0">
                          {mission.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-fun-dark-purple font-black text-sm">{mission.title}</p>
                          {mission.description && (
                            <p className="text-fun-text/50 text-xs mt-0.5 line-clamp-2 font-medium">{mission.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-1 bg-fun-yellow/20 rounded-full px-2.5 py-1">
                              <Star className="w-3.5 h-3.5 text-fun-yellow fill-fun-yellow" />
                              <span className="text-fun-purple font-black text-xs">+{mission.point_reward}</span>
                            </div>
                            {isPending && (
                              <div className="flex items-center gap-1 bg-fun-pink/20 rounded-full px-2.5 py-1">
                                <Clock className="w-3.5 h-3.5 text-fun-pink" />
                                <span className="text-fun-pink text-xs font-black">Menunggu</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {!isPending && (
                          <div className="w-9 h-9 rounded-full bg-fun-purple flex items-center justify-center flex-shrink-0 shadow-md shadow-fun-purple/20 hover:scale-105 transition-transform">
                            <Camera className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Dialog */}
      <Dialog open={!!selectedMission} onOpenChange={(v) => { if (!v) { setSelectedMission(null); setFiles([]); previewUrls.forEach(url => URL.revokeObjectURL(url)); setPreviewUrls([]); } }}>
        <DialogContent className="bg-white border-border rounded-[2.2rem] text-fun-text max-w-sm mx-auto shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-fun-dark-purple font-black text-center text-xl">
              {selectedMission?.icon} {selectedMission?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-center gap-2 bg-fun-yellow/25 rounded-2xl py-3 border border-fun-yellow/30">
              <Star className="w-6 h-6 text-fun-yellow fill-fun-yellow" />
              <span className="text-fun-purple font-black text-2xl">+{selectedMission?.point_reward}</span>
              <span className="text-fun-purple/60 text-sm font-bold">poin</span>
            </div>

            {/* Photo upload */}
            <div>
              <p className="text-fun-dark-purple text-sm font-black mb-2 text-center font-bold">Upload Foto Bukti 📸 (Maks 5 - Opsional)</p>
              <input ref={fileInputRef} type="file" accept="image/*,image/heic,image/heif,.heic,.heif" multiple onChange={handleFileSelect} className="hidden" />
              
              <div className="grid grid-cols-3 gap-2">
                {previewUrls.map((url, index) => (
                  <div key={index} className="relative rounded-2xl overflow-hidden aspect-square border-2 border-border">
                    <Image src={url} alt={`Preview ${index + 1}`} fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-black cursor-pointer z-10"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {files.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-fun-purple/50 hover:bg-fun-purple/5 transition-all cursor-pointer bg-fun-beige/25"
                  >
                    <Camera className="w-5 h-5 text-fun-purple" />
                    <span className="text-[10px] font-bold text-fun-purple">Tambah</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setSelectedMission(null); setFiles([]); previewUrls.forEach(url => URL.revokeObjectURL(url)); setPreviewUrls([]); }}
                className="flex-1 border-border rounded-xl font-bold text-fun-text hover:bg-fun-beige">
                Batal
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-fun-purple hover:bg-fun-purple/90 text-white font-black rounded-xl h-10 shadow-lg shadow-fun-purple/20 gap-2 border-none disabled:opacity-50"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Kirim...</>
                ) : (
                  <><Upload className="w-4 h-4" /> Kirim!</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
