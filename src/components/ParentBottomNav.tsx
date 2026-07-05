"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Target,
  Gift,
  CheckCircle,
  Users,
  Zap,
  LogOut,
  Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const navItems = [
  { href: "/parent/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/parent/missions", label: "Misi", icon: Target },
  { href: "/parent/rewards", label: "Hadiah", icon: Gift },
  { href: "/parent/children", label: "Anak", icon: Users },
  { href: "/parent/validations", label: "Validasi", icon: CheckCircle },
  { href: "/parent/punishments", label: "Punish", icon: Zap },
];

interface ParentBottomNavProps {
  pendingCount?: number;
}

export function ParentBottomNav({ pendingCount }: ParentBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Berhasil keluar");
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
      {/* Nav bar */}
      <nav className="bg-white/95 backdrop-blur-2xl border-t border-border px-1 pb-safe shadow-lg">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-3 px-1 rounded-2xl transition-all duration-200",
                  isActive ? "text-fun-purple" : "text-fun-text/40 hover:text-fun-text/70"
                )}
              >
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 relative",
                  isActive
                    ? "bg-fun-purple text-white shadow-md shadow-fun-purple/20 scale-105"
                    : "hover:bg-fun-beige text-fun-text/60"
                )}>
                  <Icon className="w-4 h-4" />
                  {href === "/parent/validations" && pendingCount && pendingCount > 0 ? (
                    <span className="absolute -top-1.5 -right-1.5 bg-fun-pink text-white text-[9px] font-black rounded-full w-4.5 h-4.5 flex items-center justify-center shadow-md">
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                  ) : null}
                </div>
                <span className={cn("text-[9px] font-black tracking-tight mt-0.5 transition-colors", isActive ? "text-fun-purple" : "text-fun-text/40")}>{label}</span>
              </Link>
            );
          })}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center gap-0.5 py-3 px-1 text-fun-text/40 hover:text-red-500 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-red-500/10 text-fun-text/60">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black tracking-tight mt-0.5">Keluar</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
