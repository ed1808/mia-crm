-- Crear usuario de aplicación si no existe (sin BYPASSRLS ni SUPERUSER)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'mia_app') THEN
    CREATE ROLE mia_app WITH LOGIN PASSWORD 'mia_app_password' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  ELSE
    ALTER ROLE mia_app WITH NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

-- Otorgar permisos sobre tablas y secuencias existentes y futuras
GRANT USAGE ON SCHEMA public TO mia_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO mia_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO mia_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mia_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mia_app;
