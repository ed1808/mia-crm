-- 0008_queue_rls_adjustment.sql
-- Ajuste para permitir que las funciones SECURITY DEFINER del dueño (mia_admin)
-- puedan leer colas globales mientras que mia_app sigue teniendo RLS activo (ENABLE ROW LEVEL SECURITY).

ALTER TABLE inbox_events NO FORCE ROW LEVEL SECURITY;
ALTER TABLE outbox_events NO FORCE ROW LEVEL SECURITY;
