-- Script to truncate all tables except migration tracking tables
-- This is used for Option B: Schema only (no data)

DO $
DECLARE r RECORD;
BEGIN
  EXECUTE 'SET session_replication_role = replica';
  FOR r IN
    SELECT format('%I.%I', schemaname, tablename) AS t
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog','information_schema')
      AND tablename NOT IN ('__drizzle_migrations','_prisma_migrations')
  LOOP
    EXECUTE 'TRUNCATE TABLE ' || r.t || ' RESTART IDENTITY CASCADE';
  END LOOP;
  EXECUTE 'SET session_replication_role = DEFAULT';
END$;