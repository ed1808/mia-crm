-- 0007_worker_queue_fetchers.sql
-- Funciones SECURITY DEFINER para que los workers asíncronos obtengan tareas pendientes de colas inbox y outbox

CREATE OR REPLACE FUNCTION get_pending_inbox_events(p_limit INT DEFAULT 50)
RETURNS TABLE(
  id UUID,
  tenant_id UUID,
  event_id VARCHAR,
  source_table VARCHAR,
  operation VARCHAR,
  payload JSONB,
  captured_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.tenant_id, i.event_id, i.source_table, i.operation, i.payload, i.captured_at
  FROM inbox_events i
  WHERE i.status = 'received'
  ORDER BY i.received_at ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_pending_inbox_events(INT) TO mia_app;

CREATE OR REPLACE FUNCTION get_pending_outbox_events(p_limit INT DEFAULT 50)
RETURNS TABLE(
  id UUID,
  tenant_id UUID,
  event_type VARCHAR,
  aggregate_type VARCHAR,
  aggregate_id VARCHAR,
  payload JSONB
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.tenant_id, o.event_type, o.aggregate_type, o.aggregate_id, o.payload
  FROM outbox_events o
  WHERE o.status = 'pending'
  ORDER BY o.occurred_at ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_pending_outbox_events(INT) TO mia_app;
