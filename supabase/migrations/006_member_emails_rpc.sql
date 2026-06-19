-- ============================================================
-- Migration: 006_member_emails_rpc.sql
-- Security Definer RPC function to fetch organization members with user emails from auth.users.
-- ============================================================

CREATE OR REPLACE FUNCTION get_organization_members(p_org_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  user_id UUID,
  role TEXT,
  invited_by UUID,
  invite_email TEXT,
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_email TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Tenancy check: Ensure caller is authorized (is an active member of the organization)
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.organization_id = p_org_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT 
    m.id,
    m.organization_id,
    m.user_id,
    m.role,
    m.invited_by,
    m.invite_email,
    m.invited_at,
    m.accepted_at,
    m.is_active,
    m.created_at,
    m.updated_at,
    u.email::TEXT AS user_email
  FROM organization_members m
  LEFT JOIN auth.users u ON m.user_id = u.id
  WHERE m.organization_id = p_org_id;
END;
$$;
