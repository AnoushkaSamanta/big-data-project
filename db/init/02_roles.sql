-- Create read-only role for the Next.js dashboard
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'ais_read') THEN
      CREATE ROLE ais_read WITH LOGIN PASSWORD 'ais_read_password';
   END IF;
END
$do$;

-- Grant read privileges
GRANT CONNECT ON DATABASE ais TO ais_read;
GRANT USAGE ON SCHEMA public TO ais_read;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ais_read;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ais_read;
