export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "parent" | "child";
export type TxType = "earn" | "spend" | "punish";
export type TxStatus = "pending" | "approved" | "rejected";

export interface Profile {
  id: string;
  auth_user_id: string | null;
  role: UserRole;
  name: string;
  pin: string | null;
  avatar_url: string | null;
  parent_id: string | null;
  created_at: string;
}

export interface Mission {
  id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  category: string | null;
  point_reward: number;
  icon: string;
  is_active: boolean;
  created_at: string;
}

export interface Reward {
  id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  point_cost: number;
  stock: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Punishment {
  id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  point_penalty: number;
  icon: string;
  is_active: boolean;
  created_at: string;
}

export interface Ledger {
  id: string;
  user_id: string;
  mission_id: string | null;
  reward_id: string | null;
  punishment_id: string | null;
  reviewed_by: string | null;
  type: TxType;
  points: number;
  description: string | null;
  status: TxStatus;
  proof_image_url: string | null;
  proof_image_urls: string[] | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "id" | "created_at">;
        Update: Partial<Omit<Profile, "id" | "created_at">>;
      };
      missions: {
        Row: Mission;
        Insert: Omit<Mission, "id" | "created_at">;
        Update: Partial<Omit<Mission, "id" | "created_at">>;
      };
      rewards: {
        Row: Reward;
        Insert: Omit<Reward, "id" | "created_at">;
        Update: Partial<Omit<Reward, "id" | "created_at">>;
      };
      punishments: {
        Row: Punishment;
        Insert: Omit<Punishment, "id" | "created_at">;
        Update: Partial<Omit<Punishment, "id" | "created_at">>;
      };
      ledgers: {
        Row: Ledger;
        Insert: Omit<Ledger, "id" | "created_at">;
        Update: Partial<Omit<Ledger, "id" | "created_at">>;
      };
    };

    Views: Record<string, never>;
    Functions: {
      get_child_balance: {
        Args: { p_user_id: string };
        Returns: number;
      };
      get_pending_count: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: {
      user_role: UserRole;
      tx_type: TxType;
      tx_status: TxStatus;
    };
  };
}
