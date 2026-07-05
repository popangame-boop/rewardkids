import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChildrenClient } from "@/components/ChildrenClient";

export default async function ChildrenPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: parent } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  const { data: children } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "child")
    .eq("parent_id", parent!.id)
    .order("created_at", { ascending: true });

  // Get balances
  const childrenWithBalance = await Promise.all(
    (children ?? []).map(async (child) => {
      const { data: balance } = await supabase.rpc("get_child_balance", {
        p_user_id: child.id,
      });
      return { ...child, balance: balance ?? 0 };
    })
  );

  return <ChildrenClient initialChildren={childrenWithBalance} />;
}
