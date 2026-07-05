"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notifications";

export async function getLedgers(userId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("ledgers")
    .select("*, profiles!ledgers_user_id_fkey(name, avatar_url)")
    .order("created_at", { ascending: false });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getPendingLedgers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ledgers")
    .select("*, profiles!ledgers_user_id_fkey(name, avatar_url)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function submitMissionProof(
  missionId: string,
  proofImageUrl: string,
  proofImageUrls: string[] = []
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, parent_id")
    .eq("auth_user_id", user.id)
    .single();

  const { data: mission } = await supabase
    .from("missions")
    .select("title, point_reward")
    .eq("id", missionId)
    .single();

  if (!mission) throw new Error("Mission not found");

  const finalProofImageUrl = proofImageUrl || (proofImageUrls.length > 0 ? proofImageUrls[0] : "");

  let { error } = await supabase.from("ledgers").insert({
    user_id: profile!.id,
    mission_id: missionId,
    type: "earn",
    points: mission.point_reward,
    description: `Selesai: ${mission.title}`,
    status: "pending",
    proof_image_url: finalProofImageUrl,
    proof_image_urls: proofImageUrls,
  });

  // Fallback if the database does not have the proof_image_urls column
  if (error && (error.code === "PGRST204" || error.message?.includes("proof_image_urls"))) {
    const { error: fallbackError } = await supabase.from("ledgers").insert({
      user_id: profile!.id,
      mission_id: missionId,
      type: "earn",
      points: mission.point_reward,
      description: `Selesai: ${mission.title}`,
      status: "pending",
      proof_image_url: finalProofImageUrl,
    });
    error = fallbackError;
  }

  if (error) throw new Error(error.message);

  // Notify parent
  const parentId = profile?.parent_id;
  if (parentId) {
    await createNotification({
      userId: parentId,
      title: "🎯 Misi Selesai Dilaporkan",
      content: `${profile.name} menyelesaikan misi: "${mission.title}". Butuh validasi Anda.`,
      type: "child_submitted",
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
        title: "🎯 Misi Selesai Dilaporkan",
        content: `${profile?.name || "Anak"} menyelesaikan misi: "${mission.title}". Butuh validasi Anda.`,
        type: "child_submitted",
        link: "/parent/validations",
      });
    }
  }

  revalidatePath("/child/missions");
  revalidatePath("/child/history");
  revalidatePath("/parent/validations");
}

export async function redeemReward(rewardId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, parent_id")
    .eq("auth_user_id", user.id)
    .single();

  const { data: reward } = await supabase
    .from("rewards")
    .select("title, point_cost, stock")
    .eq("id", rewardId)
    .single();

  if (!reward) throw new Error("Reward not found");

  // Check balance
  const { data: balance } = await supabase.rpc("get_child_balance", {
    p_user_id: profile!.id,
  });

  if ((balance ?? 0) < reward.point_cost) {
    throw new Error("Saldo poin tidak cukup!");
  }

  // Check stock
  if (reward.stock === 0) {
    throw new Error("Stok hadiah habis!");
  }

  const { error } = await supabase.from("ledgers").insert({
    user_id: profile!.id,
    reward_id: rewardId,
    type: "spend",
    points: reward.point_cost,
    description: `Tukar: ${reward.title}`,
    status: "pending",
  });

  if (error) throw new Error(error.message);

  // Notify parent
  const parentId = profile?.parent_id;
  if (parentId) {
    await createNotification({
      userId: parentId,
      title: "🎁 Klaim Hadiah Baru",
      content: `${profile.name} menukarkan poin untuk: "${reward.title}". Butuh persetujuan Anda.`,
      type: "child_claimed",
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
        title: "🎁 Klaim Hadiah Baru",
        content: `${profile?.name || "Anak"} menukarkan poin untuk: "${reward.title}". Butuh persetujuan Anda.`,
        type: "child_claimed",
        link: "/parent/validations",
      });
    }
  }

  revalidatePath("/child/rewards");
  revalidatePath("/child/dashboard");
  revalidatePath("/parent/validations");
}

export async function approveLedger(ledgerId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  if (profile?.role !== "parent") throw new Error("Unauthorized");

  // Check if it's a spend (reward redemption) - need to reduce stock
  const { data: ledger } = await supabase
    .from("ledgers")
    .select("user_id, reward_id, type, points, description")
    .eq("id", ledgerId)
    .single();

  const { error } = await supabase
    .from("ledgers")
    .update({
      status: "approved",
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", ledgerId);

  if (error) throw new Error(error.message);

  // Decrease reward stock if applicable
  if (ledger?.type === "spend" && ledger.reward_id) {
    await supabase.rpc("decrement_reward_stock" as never, { reward_id: ledger.reward_id });
  }

  // Notify child
  if (ledger) {
    const isEarn = ledger.type === "earn";
    await createNotification({
      userId: ledger.user_id,
      title: isEarn ? "✅ Misi Disetujui! Poin Ditambahkan" : "🎉 Hadiah Disetujui!",
      content: isEarn
        ? `Laporan misi "${ledger.description.replace("Selesai: ", "")}" disetujui. Kamu dapat +${ledger.points} Bintang!`
        : `Klaim hadiah "${ledger.description.replace("Tukar: ", "")}" disetujui. Silakan ambil hadiahmu!`,
      type: "approval",
      link: "/child/history",
    });
  }

  revalidatePath("/parent/validations");
  revalidatePath("/parent/dashboard");
}

export async function rejectLedger(ledgerId: string, reason: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  if (profile?.role !== "parent") throw new Error("Unauthorized");

  const { data: ledger } = await supabase
    .from("ledgers")
    .select("user_id, type, description")
    .eq("id", ledgerId)
    .single();

  const { error } = await supabase
    .from("ledgers")
    .update({
      status: "rejected",
      rejection_reason: reason,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", ledgerId);

  if (error) throw new Error(error.message);

  // Notify child
  if (ledger) {
    const isEarn = ledger.type === "earn";
    await createNotification({
      userId: ledger.user_id,
      title: isEarn ? "❌ Laporan Misi Perlu Diperbaiki" : "❌ Klaim Hadiah Ditolak",
      content: isEarn
        ? `Laporan misi "${ledger.description.replace("Selesai: ", "")}" ditolak.${reason ? ` Alasan: ${reason}` : ''}`
        : `Klaim hadiah "${ledger.description.replace("Tukar: ", "")}" ditolak.${reason ? ` Alasan: ${reason}` : ''}`,
      type: "rejection",
      link: "/child/history",
    });
  }

  revalidatePath("/parent/validations");
}

export async function addPunishment(childId: string, points: number, description: string, punishmentId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  if (profile?.role !== "parent") throw new Error("Unauthorized");

  const { error } = await supabase.from("ledgers").insert({
    user_id: childId,
    type: "punish",
    points,
    description,
    punishment_id: punishmentId || null,
    status: "approved", // Punishments are immediately applied
    reviewed_by: profile.id,
    reviewed_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);

  // Notify child about punishment
  await createNotification({
    userId: childId,
    title: "⚡ Poin Kamu Dikurangi",
    content: `Terjadi pelanggaran: "${description}" (-${points} Poin).`,
    type: "punish",
    link: "/child/history",
  });

  revalidatePath("/parent/punishments");
  revalidatePath("/parent/dashboard");
}
