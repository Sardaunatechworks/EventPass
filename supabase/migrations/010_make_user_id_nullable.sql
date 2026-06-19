-- Make user_id nullable in organization_members to support pending invites
ALTER TABLE organization_members ALTER COLUMN user_id DROP NOT NULL;
