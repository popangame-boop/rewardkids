import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ParentSidebar } from "@/components/ParentSidebar";
import { ParentBottomNav } from "@/components/ParentBottomNav";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile || profile.role !== "parent") {
    redirect("/login");
  }

  const { data: pending } = await supabase
    .from("ledgers")
    .select("id", { count: "exact" })
    .eq("status", "pending");

  const pendingCount = pending?.length ?? 0;

  return (
    <div className="min-h-screen bg-fun-beige text-fun-text font-sans">
      <div className="flex">
        <ParentSidebar pendingCount={pendingCount} />
        <main className="flex-1 min-h-screen lg:pt-0 pt-16 pb-24 lg:pb-0">
          <div className="p-4 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      <ParentBottomNav pendingCount={pendingCount} />
    </div>
  );
}
