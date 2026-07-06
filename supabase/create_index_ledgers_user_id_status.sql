-- Script to add composite index on public.ledgers (user_id, status)
-- to optimize queries filtering by both child user and transaction status.

CREATE INDEX IF NOT EXISTS idx_ledgers_user_id_status ON public.ledgers(user_id, status);
