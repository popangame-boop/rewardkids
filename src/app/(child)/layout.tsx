import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChildBottomNav } from "@/components/ChildBottomNav";
import { NotificationBell } from "@/components/NotificationBell";
import { Star } from "lucide-react";

export default async function ChildLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, name")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile || profile.role !== "child") {
    redirect("/login");
  }

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
        <NotificationBell />
      </header>

      <main className="relative pb-24 min-h-[calc(100vh-64px)]">
        {children}
      </main>

      <ChildBottomNav childName={profile.name} balance={balance ?? 0} />
    </div>
  );
}
