"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Star, Eye, EyeOff, Check, Sparkles, RefreshCw } from "lucide-react";
import Link from "next/link";

interface RememberedChild {
  name: string;
  pin: string;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loginMode, setLoginMode] = useState<"parent" | "child">("parent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [childName, setChildName] = useState("");
  const [childPin, setChildPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [rememberedChild, setRememberedChild] = useState<RememberedChild | null>(null);

  // Load remembered child profile
  useEffect(() => {
    const stored = localStorage.getItem("remembered_child");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as RememberedChild;
        setRememberedChild(parsed);
        setLoginMode("child");
        setChildName(parsed.name);
        setChildPin(parsed.pin);
      } catch (e) {
        localStorage.removeItem("remembered_child");
      }
    }
  }, []);

  const handleLogin = async (e?: React.FormEvent, forceChildCreds?: RememberedChild) => {
    if (e) e.preventDefault();
    setLoading(true);

    const activeChildName = forceChildCreds ? forceChildCreds.name : childName;
    const activeChildPin = forceChildCreds ? forceChildCreds.pin : childPin;

    if (loginMode === "child" || forceChildCreds) {
      if (activeChildPin.length !== 4) {
        toast.error("PIN harus berupa 4 digit angka!");
        setLoading(false);
        return;
      }

      // 1. Fetch child auth credentials using RPC
      const { data: authInfo, error: rpcError } = await supabase.rpc("get_child_auth_info", {
        p_name: activeChildName.trim(),
        p_pin: activeChildPin,
      });

      if (rpcError) {
        toast.error("Gagal melakukan verifikasi: " + rpcError.message);
        setLoading(false);
        return;
      }

      if (!authInfo || authInfo.length === 0) {
        toast.error("Nama Anak atau PIN salah!");
        setLoading(false);
        return;
      }

      const { parent_id } = authInfo[0];
      const cleanName = activeChildName.trim().replace(/\s+/g, "").toLowerCase();
      const email = `${cleanName}.${parent_id}@kidsreward.internal`;
      const password = `${activeChildPin}_${parent_id}`;

      // 2. Sign in child using deterministic credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error("Login gagal: " + error.message);
        setLoading(false);
        return;
      }

      // Save credentials if Remember Device is enabled
      if (rememberDevice) {
        localStorage.setItem(
          "remembered_child",
          JSON.stringify({ name: activeChildName, pin: activeChildPin })
        );
      } else {
        localStorage.removeItem("remembered_child");
      }

      toast.success("Selamat datang kembali! 🎉");
      router.push("/child/dashboard");
      router.refresh();
      return;
    }

    // Parent login flow
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error("Login gagal: " + error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("auth_user_id", data.user.id)
        .single<{ role: string }>();

      toast.success("Selamat datang! 🎉");
      router.push(profile?.role === "parent" ? "/parent/dashboard" : "/child/dashboard");
      router.refresh();
    }
  };

  const handleClearRemembered = () => {
    localStorage.removeItem("remembered_child");
    setRememberedChild(null);
    setChildName("");
    setChildPin("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-violet-900 flex items-center justify-center p-4">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-violet-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse delay-500" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-yellow-400 to-amber-500 shadow-2xl shadow-amber-500/30 mb-4 animate-bounce">
            <Star className="w-10 h-10 text-white fill-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Kids Reward System
          </h1>
          <p className="text-purple-300 mt-1 text-sm">
            Masuk untuk melanjutkan ✨
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8">
          {/* Tab Switcher */}
          {!rememberedChild && (
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 mb-6">
              <button
                type="button"
                onClick={() => {
                  setLoginMode("parent");
                  setLoading(false);
                }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                  loginMode === "parent"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Orang Tua 👨‍👩‍👧‍👦
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMode("child");
                  setLoading(false);
                }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                  loginMode === "child"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Anak 👶
              </button>
            </div>
          )}

          {rememberedChild && loginMode === "child" ? (
            /* Quick Login Mode */
            <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-2">
                <div className="w-20 h-20 rounded-full bg-purple-600 text-white font-black text-3xl flex items-center justify-center mx-auto shadow-lg shadow-purple-500/25 border-4 border-white/25">
                  {rememberedChild.name.charAt(0).toUpperCase()}
                </div>
                <h2 className="text-xl font-black text-white">Halo, {rememberedChild.name}! 👋</h2>
                <p className="text-purple-300 text-xs">Perangkat ini mengingat akunmu</p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => handleLogin(undefined, rememberedChild)}
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-xl shadow-lg shadow-purple-500/30 transition-all cursor-pointer flex items-center justify-center gap-2 border-none"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                      Masuk Langsung 🚀
                    </>
                  )}
                </Button>

                <button
                  type="button"
                  onClick={handleClearRemembered}
                  className="text-xs text-purple-300 hover:text-white font-semibold underline underline-offset-4 cursor-pointer"
                >
                  Gunakan Akun / PIN Lain
                </button>
              </div>
            </div>
          ) : (
            /* Standard Login Forms */
            <form onSubmit={(e) => handleLogin(e)} className="space-y-5">
              {loginMode === "parent" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white font-semibold">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="nama@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400 rounded-md h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-white font-semibold">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400 rounded-md h-12 pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="childName" className="text-white font-semibold">
                      Nama Anak
                    </Label>
                    <Input
                      id="childName"
                      type="text"
                      placeholder="Nama panggilan anak"
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      required
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400 rounded-md h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="childPin" className="text-white font-semibold">
                      PIN Login (4 digit)
                    </Label>
                    <Input
                      id="childPin"
                      type="password"
                      maxLength={4}
                      pattern="[0-9]{4}"
                      placeholder="••••"
                      value={childPin}
                      onChange={(e) => setChildPin(e.target.value.replace(/\D/g, ""))}
                      required
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400 rounded-md h-12 text-center tracking-[1em] text-xl font-bold"
                    />
                  </div>

                  {/* Remember Device Checkbox */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setRememberDevice(!rememberDevice)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                        rememberDevice
                          ? "bg-purple-600 border-purple-500 text-white"
                          : "border-white/20 bg-transparent text-transparent"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <span
                      onClick={() => setRememberDevice(!rememberDevice)}
                      className="text-xs text-purple-200 select-none cursor-pointer hover:text-white font-semibold"
                    >
                      Ingat perangkat ini (Login Otomatis)
                    </span>
                  </div>
                </>
              )}

              <Button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-base cursor-pointer border-none"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Masuk...</>
                ) : (
                  "Masuk 🚀"
                )}
              </Button>
            </form>
          )}

          {loginMode === "parent" && (
            <div className="mt-6 text-center">
              <p className="text-white/60 text-sm">
                Belum punya akun?{" "}
                <Link
                  href="/register"
                  className="text-purple-300 hover:text-white font-semibold underline-offset-4 hover:underline transition-colors"
                >
                  Daftar sebagai Orang Tua
                </Link>
              </p>
            </div>
          )}

          {rememberedChild && loginMode === "parent" && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setLoginMode("child")}
                className="text-xs text-purple-300 hover:text-white font-semibold flex items-center justify-center gap-1 mx-auto cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Kembali ke Login Cepat Anak
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
