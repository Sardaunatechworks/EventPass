-- Security Definer RPC function to safely accept organization invitations.
CREATE OR REPLACE FUNCTION accept_invitation(
  p_invite_id UUID
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member organization_members%ROWTYPE;
  v_user_id UUID;
BEGIN
  -- Get current authenticated user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', FALSE, 'message', 'Not authenticated');
  END IF;

  -- Get the pending member record
  SELECT * INTO v_member
  FROM organization_members
  WHERE id = p_invite_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'message', 'Invitation not found');
  END IF;

  IF v_member.is_active = TRUE THEN
    RETURN json_build_object('success', TRUE, 'message', 'Invitation already accepted');
  END IF;

  -- Update the record to link current user and activate the membership
  UPDATE organization_members
  SET user_id = v_user_id,
      accepted_at = NOW(),
      is_active = TRUE
  WHERE id = p_invite_id;

  RETURN json_build_object('success', TRUE, 'message', 'Invitation accepted');
END;
$$;
