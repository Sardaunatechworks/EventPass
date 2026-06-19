-- ============================================================
-- Migration: 007_fix_rls_recursion.sql
-- Fixes infinite recursion in RLS policies by using a helper
-- SECURITY DEFINER function to verify participant organization access.
-- ============================================================

-- 1. Drop the old policy that caused infinite recursion
DROP POLICY IF EXISTS "org_members_can_view_their_participants" ON participants;

-- 2. Create the helper function (SECURITY DEFINER to bypass RLS internally)
CREATE OR REPLACE FUNCTION is_org_member_of_participant(p_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM registrations r
    JOIN organization_members m ON m.organization_id = r.organization_id
    WHERE r.participant_id = p_id
      AND m.user_id = auth.uid()
      AND m.is_active = TRUE
      AND r.deleted_at IS NULL
  );
$$;

-- 3. Recreate the SELECT policy using the helper function
CREATE POLICY "org_members_can_view_their_participants"
  ON participants FOR SELECT
  USING (is_org_member_of_participant(id));
