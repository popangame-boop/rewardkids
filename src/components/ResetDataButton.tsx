"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetDemoData } from "@/app/actions/children";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function ResetDataButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleReset = async () => {
    setLoading(true);
    try {
      await resetDemoData();
      toast.success("Semua data demo (misi, hadiah, punishment, riwayat) berhasil dihapus! 🎉");
      router.refresh();
    } catch (error) {
      toast.error("Gagal mereset data: " + String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="destructive"
            className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl gap-2 shadow-md shadow-red-500/10 cursor-pointer"
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Reset Data Demo
          </Button>
        }
      />

      <AlertDialogContent className="bg-white border-border text-fun-text rounded-3xl max-w-md mx-auto shadow-2xl p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-fun-dark-purple font-black text-xl text-left">
            Apakah Anda sangat yakin?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-fun-text/70 mt-2 font-semibold text-left">
            Tindakan ini akan menghapus permanen semua:
            <ul className="list-disc list-inside mt-2 space-y-1 text-red-500 font-bold">
              <li>Misi (Missions)</li>
              <li>Hadiah (Rewards)</li>
              <li>Punishments</li>
              <li>Seluruh Riwayat & Status Validasi (Ledger)</li>
            </ul>
            <span className="block mt-3 text-fun-dark-purple font-bold">
              Akun profil anak Anda akan TETAP disimpan.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 flex flex-row items-center justify-end gap-2">
          <AlertDialogCancel className="border-border rounded-xl font-bold text-fun-text hover:bg-fun-beige mt-0 cursor-pointer">
            Batal
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleReset}
            className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl cursor-pointer"
          >
            Ya, Hapus Semua Data
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
