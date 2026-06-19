-- ============================================================
-- Migration: 009_check_email_exists.sql
-- Security Definer RPC function to verify if an email exists in auth.users.
-- ============================================================

CREATE OR REPLACE FUNCTION check_email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = lower(trim(p_email))
  );
END;
$$;

-- Explicitly grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION check_email_exists(TEXT) TO anon, authenticated;
