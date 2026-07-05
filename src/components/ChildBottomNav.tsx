"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LayoutDashboard, Target, Gift, History, LogOut, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const navItems = [
  { href: "/child/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/child/missions", label: "Misi", icon: Target },
  { href: "/child/rewards", label: "Hadiah", icon: Gift },
  { href: "/child/history", label: "Riwayat", icon: History },
];

interface ChildBottomNavProps {
  childName: string;
  balance: number;
}

export function ChildBottomNav({ childName, balance }: ChildBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sampai jumpa! 👋");
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      {/* Balance pill */}
      <div className="flex justify-center mb-2 px-4">
        <div className="bg-white border border-border rounded-full px-4 py-2 flex items-center gap-2 shadow-md shadow-fun-text/5">
          <div className="w-7 h-7 rounded-full bg-fun-purple flex items-center justify-center text-xs font-black text-white">
            {childName.charAt(0).toUpperCase()}
          </div>
          <span className="text-fun-text text-xs font-black">{childName.split(" ")[0]}</span>
          <div className="w-px h-4 bg-border" />
          <Star className="w-3.5 h-3.5 text-fun-yellow fill-fun-yellow" />
          <span className="text-fun-purple font-black text-sm">{balance}</span>
          <span className="text-fun-text/60 text-xs">poin</span>
        </div>
      </div>

      {/* Nav bar */}
      <nav className="bg-white/90 backdrop-blur-2xl border-t border-border px-2 pb-safe shadow-lg">
        <div className="flex items-center max-w-lg mx-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-2xl transition-all duration-200",
                  isActive
                    ? "text-fun-purple"
                    : "text-fun-text/40 hover:text-fun-text/70"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200",
                  isActive
                    ? "bg-fun-purple text-white shadow-lg shadow-fun-purple/30 scale-110"
                    : "hover:bg-fun-beige text-fun-text/60"
                )}>
                  <Icon className="w-5 h-5 animate-pulse-slow" />
                </div>
                <span className={cn("text-[10px] font-bold transition-colors", isActive ? "text-fun-purple" : "text-fun-text/40")}>{label}</span>
              </Link>
            );
          })}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center gap-1 py-3 px-2 text-fun-text/40 hover:text-red-500 transition-colors"
          >
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-red-500/10">
              <LogOut className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold">Keluar</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
