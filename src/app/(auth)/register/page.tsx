"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Star, Eye, EyeOff, UserPlus } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Password tidak cocok!");
      return;
    }
    if (password.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }

    setLoading(true);

    // 1. Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: "parent" },
      },
    });

    if (authError) {
      toast.error("Registrasi gagal: " + authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // 2. Create profile record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profileError } = await (supabase as any)
        .from("profiles")
        .insert({
          auth_user_id: authData.user.id,
          role: "parent",
          name,
        });

      if (profileError) {
        toast.error("Gagal membuat profil: " + profileError.message);
        setLoading(false);
        return;
      }

      toast.success("Akun berhasil dibuat! Selamat datang 🎉");
      router.push("/parent/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-violet-900 flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-yellow-400 to-amber-500 shadow-2xl shadow-amber-500/30 mb-4">
            <Star className="w-10 h-10 text-white fill-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Buat Akun Orang Tua
          </h1>
          <p className="text-purple-300 mt-1 text-sm">
            Mulai perjalanan reward bersama anak ✨
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8">
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="reg-name" className="text-white font-semibold">
                Nama Lengkap
              </Label>
              <Input
                id="reg-name"
                type="text"
                placeholder="Nama orang tua"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 rounded-xl h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-email" className="text-white font-semibold">
                Email
              </Label>
              <Input
                id="reg-email"
                type="email"
                placeholder="contoh@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 rounded-xl h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-password" className="text-white font-semibold">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 rounded-xl h-12 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-confirm-password" className="text-white font-semibold">
                Konfirmasi Password
              </Label>
              <Input
                id="reg-confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="Ulangi password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 rounded-xl h-12"
              />
            </div>

            <Button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white font-bold rounded-xl shadow-lg shadow-amber-500/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-base"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Mendaftar...</>
              ) : (
                <><UserPlus className="w-5 h-5 mr-2" /> Daftar Sekarang</>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-white/60 text-sm">
              Sudah punya akun?{" "}
              <Link
                href="/login"
                className="text-purple-300 hover:text-white font-semibold underline-offset-4 hover:underline transition-colors"
              >
                Masuk
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
