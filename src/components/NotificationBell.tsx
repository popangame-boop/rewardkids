"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Clock, MessageSquare, Award, Star, X } from "lucide-react";
import { getNotifications, markAsRead, markAllAsRead } from "@/app/actions/notifications";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export function NotificationBell() {
  const router = useRouter();
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get current profile
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (profile) {
        setUserId(profile.id);
      }
    };

    getProfile();
  }, [supabase]);

  const loadNotifications = async () => {
    const data = await getNotifications();
    // Map database notification records
    setNotifications(data as Notification[]);
  };

  useEffect(() => {
    loadNotifications();

    // Ask for browser push notification permissions
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, [userId]);

  // Set up real-time subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-notifications-${userId}-${Math.random().toString(36).substring(7)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);

          // Play a nice notification sound if supported
          try {
            const audio = new Audio("/sounds/notification.mp3");
            audio.play().catch(() => {});
          } catch (e) {}

          // Browser Push Notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(newNotif.title, {
              body: newNotif.content,
              icon: "/favicon.ico",
            });
          }

          // In-App Toast
          toast(newNotif.title, {
            description: newNotif.content,
            action: newNotif.link ? {
              label: "Buka",
              onClick: () => {
                router.push(newNotif.link!);
                router.refresh();
              }
            } : undefined,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, router]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAsRead = async (id: string, link: string | null) => {
    try {
      await markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      if (link) {
        setIsOpen(false);
        router.push(link);
        router.refresh();
      }
    } catch (e) {
      toast.error("Gagal memperbarui status notifikasi");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success("Semua notifikasi ditandai dibaca");
    } catch (e) {
      toast.error("Gagal menandai semua dibaca");
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "parent_comment":
      case "child_comment":
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case "new_mission":
      case "child_submitted":
        return <Star className="w-4 h-4 text-amber-500 fill-amber-500" />;
      case "new_reward":
      case "child_claimed":
        return <Award className="w-4 h-4 text-purple-500" />;
      default:
        return <Bell className="w-4 h-4 text-fun-purple" />;
    }
  };

  return (
    <div className="relative z-50">
      {/* Bell Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-10 h-10 rounded-full bg-fun-purple/10 border border-fun-purple/20 flex items-center justify-center text-fun-purple hover:bg-fun-purple/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
      >
        {unreadCount > 0 ? (
          <Bell className="w-5 h-5 animate-swing" />
        ) : (
          <Bell className="w-5 h-5" />
        )}

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-fun-pink text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover */}
      {isOpen && (
        <>
          {/* Overlay to close */}
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 mt-2 w-80 max-h-[400px] overflow-hidden bg-white border border-border rounded-lg shadow-2xl z-50 flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-fun-beige/50">
              <span className="font-black text-fun-dark-purple text-sm">Notifikasi 🔔</span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-black text-fun-teal hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Check className="w-3 h-3" /> Semua dibaca
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-fun-text/40 hover:text-fun-text cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/60">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-fun-text/40 text-xs font-semibold">
                  Belum ada notifikasi baru
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleMarkAsRead(notif.id, notif.link)}
                    onPointerEnter={() => notif.link && router.prefetch(notif.link)}
                    onTouchStart={() => notif.link && router.prefetch(notif.link)}
                    className={`p-3.5 flex gap-3 transition-colors cursor-pointer hover:bg-fun-beige/35 ${
                      !notif.is_read ? "bg-fun-yellow/5 border-l-4 border-l-fun-yellow" : ""
                    }`}
                  >
                    <div className="w-7 h-7 rounded-xl bg-fun-beige flex items-center justify-center flex-shrink-0 mt-0.5">
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black text-fun-dark-purple truncate`}>
                        {notif.title}
                      </p>
                      <p className="text-fun-text/70 text-[11px] font-semibold mt-0.5 leading-normal">
                        {notif.content}
                      </p>
                      <div className="flex items-center gap-1.5 text-[9px] text-fun-text/40 font-bold mt-1 uppercase tracking-wider">
                        <Clock className="w-3 h-3" />
                        {new Date(notif.created_at).toLocaleDateString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "numeric",
                          month: "short",
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
