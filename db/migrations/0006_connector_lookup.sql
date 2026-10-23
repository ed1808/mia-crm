-- 0006_connector_lookup.sql
-- Función SECURITY DEFINER para resolver de forma segura el tenant a partir del hash del API Key

CREATE OR REPLACE FUNCTION lookup_connector_by_token(p_hash VARCHAR)
RETURNS TABLE(connector_id UUID, tenant_id UUID, connector_name VARCHAR)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.tenant_id, c.name
  FROM connectors c
  WHERE c.api_key_hash = p_hash
    AND c.is_active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION lookup_connector_by_token(VARCHAR) TO mia_app;
