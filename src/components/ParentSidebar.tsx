"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Target,
  Gift,
  Users,
  CheckCircle,
  Zap,
  LogOut,
  Menu,
  X,
  Star,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";

const navItems = [
  { href: "/parent/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/parent/missions", label: "Misi", icon: Target },
  { href: "/parent/rewards", label: "Hadiah", icon: Gift },
  { href: "/parent/children", label: "Anak", icon: Users },
  { href: "/parent/validations", label: "Validasi", icon: CheckCircle },
  { href: "/parent/punishments", label: "Punishment", icon: Zap },
];

export function ParentSidebar({ pendingCount }: { pendingCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Berhasil keluar");
    router.push("/login");
    router.refresh();
  };

  const NavContent = () => (
    <div className="flex flex-col h-full bg-white">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-fun-purple flex items-center justify-center shadow-md shadow-fun-purple/10">
            <Star className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <p className="font-black text-fun-dark-purple text-sm leading-none">Kids Reward</p>
            <p className="text-fun-text/40 text-[10px] mt-0.5 font-bold uppercase tracking-wider">Panel Orang Tua</p>
          </div>
        </div>
        <NotificationBell />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 group",
                isActive
                  ? "bg-fun-purple text-white shadow-md shadow-fun-purple/15"
                  : "text-fun-text/60 hover:text-fun-purple hover:bg-fun-purple/5"
              )}
            >
              <Icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-white" : "text-fun-text/60 group-hover:text-fun-purple")} />
              <span className="flex-1">{label}</span>
              {href === "/parent/validations" && pendingCount && pendingCount > 0 ? (
                <span className="bg-fun-pink text-white text-xs font-black rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              ) : isActive ? (
                <ChevronRight className="w-4 h-4" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-border">
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start gap-3 text-fun-text/60 hover:text-red-500 hover:bg-red-500/5 rounded-xl font-bold border-none"
        >
          <LogOut className="w-5 h-5" />
          Keluar
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border h-screen sticky top-0 shadow-sm">
        <NavContent />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-45 bg-white/95 backdrop-blur-md border-b border-border flex items-center justify-between px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-fun-purple flex items-center justify-center">
            <Star className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="font-black text-fun-dark-purple text-sm">Kids Reward</span>
        </div>
        <NotificationBell />
      </div>
    </>
  );
}
