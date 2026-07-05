import { createClient, getCachedProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChildBottomNav } from "@/components/ChildBottomNav";
import { NotificationBell } from "@/components/NotificationBell";
import { Star } from "lucide-react";

export default async function ChildLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCachedProfile();

  if (!user || !profile || profile.role !== "child") {
    redirect("/login");
  }

  const supabase = await createClient();


  const { data: balance } = await supabase.rpc("get_child_balance", {
    p_user_id: profile.id,
  });

  return (
    <div className="min-h-screen bg-fun-beige text-fun-text font-sans selection:bg-fun-pink/30">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-fun-yellow rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute top-1/3 -left-20 w-64 h-64 bg-fun-pink rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-700" />
        <div className="absolute -bottom-20 right-1/3 w-64 h-64 bg-fun-teal rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse delay-1000" />
      </div>

      {/* Global Header with Notification Bell */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-border/80 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-fun-purple flex items-center justify-center">
            <Star className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="font-black text-fun-dark-purple text-sm">Kids Reward</span>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Status/Balance Pill */}
          <div className="bg-fun-beige/60 border border-border/60 rounded-full pl-1.5 pr-3 py-1 flex items-center gap-1.5 shadow-sm">
            <div className="w-6 h-6 rounded-full bg-fun-purple flex items-center justify-center text-[10px] font-black text-white">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-fun-text text-[11px] font-bold">{profile.name.split(" ")[0]}</span>
            <div className="w-px h-3 bg-border/80" />
            <Star className="w-3.5 h-3.5 text-fun-yellow fill-fun-yellow" />
            <span className="text-fun-purple font-black text-xs">{balance ?? 0}</span>
            <span className="text-fun-text/60 text-[10px]">poin</span>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="relative pb-24 min-h-[calc(100vh-64px)]">
        {children}
      </main>

      <ChildBottomNav />
    </div>
  );
}
