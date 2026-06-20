-- 1. Create secure platform admin RPC functions

-- A. Stats Function
CREATE OR REPLACE FUNCTION get_platform_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_email TEXT;
  v_orgs_count INT;
  v_events_count INT;
  v_regs_count INT;
  v_certs_count INT;
  result JSON;
BEGIN
  -- Verify caller is the platform admin
  v_caller_email := auth.jwt() ->> 'email';
  IF v_caller_email IS NULL OR v_caller_email != 'admin@myeventpass.com.ng' THEN
    RAISE EXCEPTION 'Unauthorized: Access denied';
  END IF;

  SELECT COUNT(*) INTO v_orgs_count FROM organizations WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO v_events_count FROM events WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO v_regs_count FROM registrations WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO v_certs_count FROM certificates WHERE revoked_at IS NULL;

  SELECT json_build_object(
    'total_organizations', COALESCE(v_orgs_count, 0),
    'total_events', COALESCE(v_events_count, 0),
    'total_registrations', COALESCE(v_regs_count, 0),
    'total_certificates', COALESCE(v_certs_count, 0)
  ) INTO result;

  RETURN result;
END;
$$;

-- B. List Organizations Function
CREATE OR REPLACE FUNCTION list_platform_organizations()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  email TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  events_count BIGINT,
  members_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is the platform admin
  IF auth.jwt() ->> 'email' IS NULL OR auth.jwt() ->> 'email' != 'admin@myeventpass.com.ng' THEN
    RAISE EXCEPTION 'Unauthorized: Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.slug,
    o.email,
    o.is_active,
    o.created_at,
    (SELECT COUNT(*) FROM events e WHERE e.organization_id = o.id AND e.deleted_at IS NULL) as events_count,
    (SELECT COUNT(*) FROM organization_members m WHERE m.organization_id = o.id AND m.is_active = true) as members_count
  FROM organizations o
  WHERE o.deleted_at IS NULL
  ORDER BY o.created_at DESC;
END;
$$;

-- C. Toggle Active State Function
CREATE OR REPLACE FUNCTION toggle_organization_active(p_org_id UUID, p_is_active BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is the platform admin
  IF auth.jwt() ->> 'email' IS NULL OR auth.jwt() ->> 'email' != 'admin@myeventpass.com.ng' THEN
    RAISE EXCEPTION 'Unauthorized: Access denied';
  END IF;

  UPDATE organizations
  SET is_active = p_is_active,
      updated_at = NOW()
  WHERE id = p_org_id AND deleted_at IS NULL;

  RETURN TRUE;
END;
$$;

-- D. List Global Audit Logs Function
CREATE OR REPLACE FUNCTION list_platform_audit_logs()
RETURNS TABLE (
  id UUID,
  organization_name TEXT,
  action TEXT,
  resource_type TEXT,
  created_at TIMESTAMPTZ,
  user_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is the platform admin
  IF auth.jwt() ->> 'email' IS NULL OR auth.jwt() ->> 'email' != 'admin@myeventpass.com.ng' THEN
    RAISE EXCEPTION 'Unauthorized: Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    l.id,
    COALESCE(o.name, 'Platform'),
    l.action,
    l.resource_type,
    l.created_at,
    COALESCE(u.email, 'System')
  FROM audit_logs l
  LEFT JOIN organizations o ON l.organization_id = o.id
  LEFT JOIN auth.users u ON l.created_by = u.id
  ORDER BY l.created_at DESC
  LIMIT 200;
END;
$$;


-- 2. Seed Super Admin User securely
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
)
SELECT 
  '00000000-0000-0000-0000-000000000000',
  uuid_generate_v4(),
  'authenticated',
  'authenticated',
  'admin@myeventpass.com.ng',
  extensions.crypt('EventPassAdmin2026!', extensions.gen_salt('bf', 10)),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Platform Owner", "must_change_password": true}',
  NOW(),
  NOW(),
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'admin@myeventpass.com.ng'
);
