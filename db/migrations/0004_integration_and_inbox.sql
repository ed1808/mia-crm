-- 0004_integration_and_inbox.sql
-- Conectores de integración y Webhook Inbox para ingesta idempotente del ERP

-- Tabla de conectores externos (ej. Adaptador SQL Server DMS)
CREATE TABLE IF NOT EXISTS connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'erp_sql_server',
  api_key_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_connectors ON connectors
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE INDEX IF NOT EXISTS idx_connectors_tenant ON connectors (tenant_id);

-- Tabla de Inbox de eventos entrantes para garantizar idempotencia por tenant y trazabilidad
CREATE TABLE IF NOT EXISTS inbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connector_id UUID REFERENCES connectors(id) ON DELETE SET NULL,
  event_id VARCHAR(100) NOT NULL,
  source_table VARCHAR(100) NOT NULL,
  operation VARCHAR(20) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'received', -- 'received', 'processing', 'processed', 'failed'
  error_message TEXT,
  captured_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT uq_inbox_tenant_event UNIQUE (tenant_id, event_id)
);

ALTER TABLE inbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_events FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_inbox_events ON inbox_events
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE INDEX IF NOT EXISTS idx_inbox_pending ON inbox_events (status, received_at) WHERE status = 'received';
CREATE INDEX IF NOT EXISTS idx_inbox_tenant_table ON inbox_events (tenant_id, source_table);

-- Tabla para registro de errores o dependencias de ordenamiento (ej. OT antes de creación de vehículo)
CREATE TABLE IF NOT EXISTS ingest_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inbox_event_id UUID REFERENCES inbox_events(id) ON DELETE CASCADE,
  source_table VARCHAR(100) NOT NULL,
  error_type VARCHAR(50) NOT NULL, -- 'missing_parent', 'translation_error', 'unmapped_schema'
  error_detail TEXT NOT NULL,
  retry_count INT NOT NULL DEFAULT 0,
  retry_after TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ingest_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_errors FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_ingest_errors ON ingest_errors
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE INDEX IF NOT EXISTS idx_ingest_errors_retry ON ingest_errors (tenant_id, retry_after) WHERE resolved_at IS NULL;
