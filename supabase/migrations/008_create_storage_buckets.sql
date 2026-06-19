-- ============================================================
-- Migration: 008_create_storage_buckets.sql
-- Creates the required Supabase Storage buckets and configures
-- Row Level Security (RLS) policies for secure uploads.
-- ============================================================

-- 1. Insert buckets if they do not exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('organization-assets', 'organization-assets', true),
  ('tickets', 'tickets', true),
  ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Policy: Public read access for all assets, tickets, and certificates
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Public Read Access"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('organization-assets', 'tickets', 'certificates'));

-- 3. Policy: Authenticated staff can upload organization assets (logos) to their own folder
-- We extract the organization ID from the first segment of the path and check membership.
DROP POLICY IF EXISTS "Allow members to upload organization assets" ON storage.objects;
CREATE POLICY "Allow members to upload organization assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'organization-assets'
    AND public.is_org_member((storage.foldername(name))[1]::UUID)
  );

DROP POLICY IF EXISTS "Allow members to update organization assets" ON storage.objects;
CREATE POLICY "Allow members to update organization assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'organization-assets'
    AND public.is_org_member((storage.foldername(name))[1]::UUID)
  )
  WITH CHECK (
    bucket_id = 'organization-assets'
    AND public.is_org_member((storage.foldername(name))[1]::UUID)
  );

-- 4. Policy: Authenticated staff can delete organization assets in their folder
DROP POLICY IF EXISTS "Allow members to delete organization assets" ON storage.objects;
CREATE POLICY "Allow members to delete organization assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'organization-assets'
    AND public.is_org_member((storage.foldername(name))[1]::UUID)
  );
