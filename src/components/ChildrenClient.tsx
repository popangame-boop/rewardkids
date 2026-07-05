"use client";

import { useState } from "react";
import { createChildAccount } from "@/app/actions/children";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Star, Users, Eye, EyeOff } from "lucide-react";
import { Profile } from "@/types/supabase";

type ChildWithBalance = Profile & { balance: number };

interface ChildrenClientProps {
  initialChildren: ChildWithBalance[];
}

export function ChildrenClient({ initialChildren }: ChildrenClientProps) {
  const [children, setChildren] = useState(initialChildren);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    pin: "",
  });

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
      window.location.reload();
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
