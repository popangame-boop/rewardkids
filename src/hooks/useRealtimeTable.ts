import { useEffect } from "react";
import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeTable<T extends { id: string }>(
  tableName: string,
  initialData: T[],
  options?: {
    filter?: string;
    onInsert?: (payload: any) => Promise<T | null> | T | null;
    onUpdate?: (payload: any) => Promise<T | null> | T | null;
    onDelete?: (payload: any) => string | null;
    onEvent?: (payload: any) => void;
  }
) {
  const supabase = createClient();
  const cacheKey = [tableName, options?.filter];

  const { data: swrData, mutate } = useSWR<T[]>(
    cacheKey,
    async () => {
      let query = supabase.from(tableName).select("*");
      if (options?.filter) {
        const parts = options.filter.split("=");
        if (parts.length === 2) {
          const field = parts[0];
          const valWithOp = parts[1];
          const opParts = valWithOp.split(".");
          if (opParts.length === 2 && opParts[0] === "eq") {
            query = query.eq(field, opParts[1]);
          }
        }
      }
      
      // Order ledgers by created_at desc. Other tables by created_at or id desc.
      if (tableName === "ledgers" || tableName === "ledger_comments") {
        query = query.order("created_at", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching " + tableName + ":", error);
        throw error;
      }
      return data as T[];
    },
    {
      fallbackData: initialData,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  const data = swrData || initialData;

  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${tableName}-${Math.random().toString(36).substring(7)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableName,
          filter: options?.filter,
        },
        async (payload) => {
          if (options?.onEvent) {
            options.onEvent(payload);
          }

          if (payload.eventType === "INSERT") {
            let newItem = payload.new as T;
            if (options?.onInsert) {
              const res = await options.onInsert(payload);
              if (res) newItem = res;
            }
            mutate((prev) => [newItem, ...(prev || [])], false);
          } else if (payload.eventType === "UPDATE") {
            let updatedItem = payload.new as T;
            if (options?.onUpdate) {
              const res = await options.onUpdate(payload);
              if (res) updatedItem = res;
            }
            mutate(
              (prev) =>
                (prev || []).map((item) => (item.id === updatedItem.id ? updatedItem : item)),
              false
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = options?.onDelete
              ? options.onDelete(payload)
              : (payload.old as any).id;
            if (deletedId) {
              mutate((prev) => (prev || []).filter((item) => item.id !== deletedId), false);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, options?.filter, mutate, supabase]);

  const setData = (newData: T[] | ((prev: T[]) => T[])) => {
    if (typeof newData === "function") {
      mutate(newData as any, false);
    } else {
      mutate(newData, false);
    }
  };

  return [data, setData] as const;
}
