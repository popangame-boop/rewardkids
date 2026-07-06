-- ============================================================
-- Kids Reward System - Full Database Schema
-- ============================================================

-- [1. Extensions]
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- [2. Custom Types]
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('parent', 'child');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_type') THEN
        CREATE TYPE tx_type AS ENUM ('earn', 'spend', 'punish');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_status') THEN
        CREATE TYPE tx_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END$$;

-- [3. Core Tables]
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    role user_role NOT NULL DEFAULT 'child',
    name TEXT NOT NULL,
    pin TEXT,
    avatar_url TEXT,
    parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure parent_id and avatar_url exist if table was created in original schema
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    point_reward INT NOT NULL CHECK (point_reward > 0),
    icon TEXT DEFAULT '⭐',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure created_by and description exist if table was created in original schema
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '⭐';
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    point_cost INT NOT NULL CHECK (point_cost > 0),
    stock INT DEFAULT -1,  -- -1 = unlimited
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure created_by, description, stock, and created_at exist if table was created in original schema
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS stock INT DEFAULT -1;
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.punishments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    point_penalty INT NOT NULL CHECK (point_penalty > 0),
    icon TEXT DEFAULT '⚡',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure created_by, description, and created_at exist if table was created in original schema
ALTER TABLE public.punishments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.punishments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.punishments ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '⚡';
ALTER TABLE public.punishments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();


CREATE TABLE IF NOT EXISTS public.ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL,
    reward_id UUID REFERENCES public.rewards(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    type tx_type NOT NULL,
    points INT NOT NULL,
    description TEXT,
    status tx_status DEFAULT 'pending',
    proof_image_url TEXT,
    proof_image_urls TEXT[] DEFAULT '{}',
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- Ensure references, rejection_reason and review details exist if table was created in original schema
ALTER TABLE public.ledgers ADD COLUMN IF NOT EXISTS mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL;
ALTER TABLE public.ledgers ADD COLUMN IF NOT EXISTS reward_id UUID REFERENCES public.rewards(id) ON DELETE SET NULL;
ALTER TABLE public.ledgers ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.ledgers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.ledgers ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.ledgers ADD COLUMN IF NOT EXISTS punishment_id UUID REFERENCES public.punishments(id) ON DELETE SET NULL;
ALTER TABLE public.ledgers ADD COLUMN IF NOT EXISTS proof_image_urls TEXT[] DEFAULT '{}';


-- [4. Helper Function: Get Child Balance]
CREATE OR REPLACE FUNCTION public.get_child_balance(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN type = 'earn' AND status = 'approved' THEN points
      WHEN type = 'spend' AND status = 'approved' THEN -points
      WHEN type = 'punish' AND status = 'approved' THEN -points
      ELSE 0
    END
  ), 0)
  FROM public.ledgers
  WHERE user_id = p_user_id;
$$;

-- [5. Helper Function: Get Pending Count]
CREATE OR REPLACE FUNCTION public.get_pending_count()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INT FROM public.ledgers WHERE status = 'pending';
$$;

-- [5.1 Helper Function: Decrement Reward Stock]
CREATE OR REPLACE FUNCTION public.decrement_reward_stock(reward_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.rewards
  SET stock = CASE WHEN stock > 0 THEN stock - 1 ELSE stock END
  WHERE id = reward_id;
END;
$$;

-- ============================================================
-- [6. Row Level Security (RLS)]
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledgers ENABLE ROW LEVEL SECURITY;


-- [6.1 Profiles RLS]
-- Allow all authenticated users to view profiles (avoids infinite recursion)
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_children" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Users can update their own profile
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- Authenticated users can insert profiles (for signup and creating child accounts)
DROP POLICY IF EXISTS "profiles_insert_parent" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_auth" ON public.profiles;
CREATE POLICY "profiles_insert_auth" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = auth_user_id OR auth.uid() IS NOT NULL);

-- [6.2 Missions RLS]
-- Everyone authenticated can read active missions
DROP POLICY IF EXISTS "missions_select_active" ON public.missions;
CREATE POLICY "missions_select_active" ON public.missions
    FOR SELECT USING (is_active = TRUE AND auth.uid() IS NOT NULL);

-- Parents can see all missions they created
DROP POLICY IF EXISTS "missions_select_parent" ON public.missions;
CREATE POLICY "missions_select_parent" ON public.missions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.role = 'parent'
            AND p.id = missions.created_by
        )
    );

-- Only parents can insert missions
DROP POLICY IF EXISTS "missions_insert_parent" ON public.missions;
CREATE POLICY "missions_insert_parent" ON public.missions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.role = 'parent'
        )
    );

-- Only parents can update their own missions
DROP POLICY IF EXISTS "missions_update_parent" ON public.missions;
CREATE POLICY "missions_update_parent" ON public.missions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.role = 'parent'
            AND p.id = missions.created_by
        )
    );

-- Only parents can delete their own missions
DROP POLICY IF EXISTS "missions_delete_parent" ON public.missions;
CREATE POLICY "missions_delete_parent" ON public.missions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.role = 'parent'
            AND p.id = missions.created_by
        )
    );

-- [6.3 Rewards RLS]
DROP POLICY IF EXISTS "rewards_select_active" ON public.rewards;
CREATE POLICY "rewards_select_active" ON public.rewards
    FOR SELECT USING (is_active = TRUE AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "rewards_select_parent" ON public.rewards;
CREATE POLICY "rewards_select_parent" ON public.rewards
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.role = 'parent'
            AND p.id = rewards.created_by
        )
    );

DROP POLICY IF EXISTS "rewards_insert_parent" ON public.rewards;
CREATE POLICY "rewards_insert_parent" ON public.rewards
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.role = 'parent'
        )
    );

DROP POLICY IF EXISTS "rewards_update_parent" ON public.rewards;
CREATE POLICY "rewards_update_parent" ON public.rewards
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.role = 'parent'
            AND p.id = rewards.created_by
        )
    );

DROP POLICY IF EXISTS "rewards_delete_parent" ON public.rewards;
CREATE POLICY "rewards_delete_parent" ON public.rewards
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.role = 'parent'
            AND p.id = rewards.created_by
        )
    );

-- [6.3.5 Punishments RLS]
DROP POLICY IF EXISTS "punishments_select_active" ON public.punishments;
CREATE POLICY "punishments_select_active" ON public.punishments
    FOR SELECT USING (is_active = TRUE AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "punishments_select_parent" ON public.punishments;
CREATE POLICY "punishments_select_parent" ON public.punishments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.role = 'parent'
            AND p.id = punishments.created_by
        )
    );

DROP POLICY IF EXISTS "punishments_insert_parent" ON public.punishments;
CREATE POLICY "punishments_insert_parent" ON public.punishments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.role = 'parent'
        )
    );

DROP POLICY IF EXISTS "punishments_update_parent" ON public.punishments;
CREATE POLICY "punishments_update_parent" ON public.punishments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.role = 'parent'
            AND p.id = punishments.created_by
        )
    );

DROP POLICY IF EXISTS "punishments_delete_parent" ON public.punishments;
CREATE POLICY "punishments_delete_parent" ON public.punishments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.role = 'parent'
            AND p.id = punishments.created_by
        )
    );

-- [6.4 Ledgers RLS]
-- Children can view their own ledger entries
DROP POLICY IF EXISTS "ledgers_select_own" ON public.ledgers;
CREATE POLICY "ledgers_select_own" ON public.ledgers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.id = ledgers.user_id
        )
    );

-- Parents can view all ledger entries for their children
DROP POLICY IF EXISTS "ledgers_select_parent" ON public.ledgers;
CREATE POLICY "ledgers_select_parent" ON public.ledgers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.role = 'parent'
        )
    );

-- Children can insert earn/spend entries (pending status)
DROP POLICY IF EXISTS "ledgers_insert_child" ON public.ledgers;
CREATE POLICY "ledgers_insert_child" ON public.ledgers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.id = ledgers.user_id
            AND p.role = 'child'
        )
        AND ledgers.status = 'pending'
        AND ledgers.type IN ('earn', 'spend')
    );

-- Parents can insert punishment entries
DROP POLICY IF EXISTS "ledgers_insert_parent" ON public.ledgers;
CREATE POLICY "ledgers_insert_parent" ON public.ledgers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.role = 'parent'
        )
        AND ledgers.type = 'punish'
    );

-- Parents can update ledger status (approve/reject)
DROP POLICY IF EXISTS "ledgers_update_parent" ON public.ledgers;
CREATE POLICY "ledgers_update_parent" ON public.ledgers
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.role = 'parent'
        )
    );

-- ============================================================
-- [7. Storage: proofs bucket]
-- ============================================================
-- Run in Supabase Dashboard > Storage > New Bucket: "proofs" (public: false)
-- Then add these policies in Storage > Policies:

-- INSERT: Authenticated users can upload to their own folder
-- (path must start with their user_id)
-- Policy name: "Allow authenticated uploads"
-- Allowed operations: INSERT
-- Policy definition: (bucket_id = 'proofs' AND auth.uid()::text = (storage.foldername(name))[1])

-- SELECT: Authenticated users can view files in their folder + parents see all
-- Policy name: "Allow authenticated reads"
-- Allowed operations: SELECT
-- Policy definition: bucket_id = 'proofs' AND auth.uid() IS NOT NULL

-- DELETE: Users can delete their own files
-- Policy name: "Allow own file deletion"
-- Allowed operations: DELETE
-- Policy definition: (bucket_id = 'proofs' AND auth.uid()::text = (storage.foldername(name))[1])

-- ============================================================
-- [8. Indexes for Performance]
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_parent_id ON public.profiles(parent_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_user_id ON public.ledgers(user_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_status ON public.ledgers(status);
CREATE INDEX IF NOT EXISTS idx_ledgers_user_id_status ON public.ledgers(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ledgers_type ON public.ledgers(type);
CREATE INDEX IF NOT EXISTS idx_missions_is_active ON public.missions(is_active);
CREATE INDEX IF NOT EXISTS idx_rewards_is_active ON public.rewards(is_active);
CREATE INDEX IF NOT EXISTS idx_punishments_is_active ON public.punishments(is_active);

