"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notifications";

export async function getComments(ledgerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ledger_comments")
    .select(`
      *,
      profiles!ledger_comments_sender_id_fkey (
        name,
        avatar_url,
        role
      )
    `)
    .eq("ledger_id", ledgerId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function addComment(ledgerId: string, content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get current user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, role, parent_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile) throw new Error("Profile not found");

  // Insert comment
  const { data: comment, error } = await supabase
    .from("ledger_comments")
    .insert({
      ledger_id: ledgerId,
      sender_id: profile.id,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Get ledger details to know who to notify
  const { data: ledger } = await supabase
    .from("ledgers")
    .select("user_id, description")
    .eq("id", ledgerId)
    .single();

  if (ledger) {
    if (profile.role === "parent") {
      // Parent commented -> Notify the child
      await createNotification({
        userId: ledger.user_id,
        title: "💬 Komentar Baru Orang Tua",
        content: `${profile.name} mengomentari laporanmu: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
        type: "parent_comment",
        link: "/child/history",
      });
    } else {
      // Child commented -> Notify parent
      // Find parent of this child
      const recipientId = profile.parent_id;
      if (recipientId) {
        await createNotification({
          userId: recipientId,
          title: "💬 Anak Mengirim Komentar",
          content: `${profile.name} membalas komentar di laporan: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
          type: "child_comment",
          link: "/parent/validations",
        });
      } else {
        // Fallback: Notify any parent
        const { data: parents } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "parent")
          .limit(1);
        if (parents && parents.length > 0) {
          await createNotification({
            userId: parents[0].id,
            title: "💬 Anak Mengirim Komentar",
            content: `${profile.name} membalas komentar di laporan: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
            type: "child_comment",
            link: "/parent/validations",
          });
        }
      }
    }
  }

  revalidatePath("/parent/validations");
  revalidatePath("/child/history");
  return comment;
}
