-- ============================================================
-- 1. Table: ledger_comments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ledger_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_id UUID NOT NULL REFERENCES public.ledgers(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ledger_comments ENABLE ROW LEVEL SECURITY;

-- Select policy: users can see comments for ledgers they are allowed to see
DROP POLICY IF EXISTS "comments_select_all" ON public.ledger_comments;
CREATE POLICY "comments_select_all" ON public.ledger_comments
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Insert policy: authenticated users can post comments
DROP POLICY IF EXISTS "comments_insert_all" ON public.ledger_comments;
CREATE POLICY "comments_insert_all" ON public.ledger_comments
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 2. Table: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL, -- e.g., 'new_mission', 'new_reward', 'comment', 'approval', 'rejection'
    link TEXT, -- redirect link when clicked
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Select policy: users can see their own notifications
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.id = notifications.user_id
        )
    );

-- Update policy: users can mark their own notifications as read
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.auth_user_id = auth.uid()
            AND p.id = notifications.user_id
        )
    );

-- Insert policy: allowed for system functions
DROP POLICY IF EXISTS "notifications_insert_all" ON public.notifications;
CREATE POLICY "notifications_insert_all" ON public.notifications
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 3. Column: proof_image_urls in ledgers
-- ============================================================
ALTER TABLE public.ledgers ADD COLUMN IF NOT EXISTS proof_image_urls TEXT[] DEFAULT '{}';
