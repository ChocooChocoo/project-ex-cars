-- Drop all application schemas so migrations can recreate everything from scratch.
-- Supabase infrastructure schemas (auth, storage, realtime, graphql_public) are untouched.

DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS private CASCADE;

CREATE SCHEMA public;
CREATE SCHEMA private;

-- Re-establish schema access for PostgREST roles (lost when the schema was dropped).
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA private TO postgres, service_role;

-- Default privileges so tables/sequences/functions created by migrations are
-- accessible to the PostgREST roles without explicit per-table grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;

-- Drop all storage.objects policies (they survive the public schema drop).
-- Migrations 00021/00023/00027/00028 recreate the ones the app needs.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;
