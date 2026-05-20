-- ============================================================================
-- Bakala ERP — User Profiles & Role-Based Access Control (RBAC)
-- Links to Supabase native auth.users for role assignment.
-- ============================================================================

CREATE TYPE user_role AS ENUM ('admin', 'cashier');

CREATE TABLE user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  full_name  TEXT,
  role       user_role NOT NULL DEFAULT 'cashier',
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON user_profiles(role);
CREATE INDEX idx_profiles_email ON user_profiles(email);

COMMENT ON TABLE user_profiles IS 'User profiles linked to Supabase auth.users with RBAC role assignment.';
COMMENT ON COLUMN user_profiles.role IS 'admin = full access; cashier = POS + expenses only';

-- Auto-update timestamp trigger
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can read their own profile; admins can read all
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update profiles"
  ON user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to auto-create a profile when a user signs up
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_full_name TEXT;
  v_role_text TEXT;
BEGIN
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NEW.email
  );

  v_role_text := NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), '');

  IF v_role_text IS NOT NULL AND v_role_text IN ('admin', 'cashier') THEN
    v_role := v_role_text::user_role;
  ELSE
    v_role := 'cashier'::user_role;
  END IF;

  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, v_full_name, v_role);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.user_profiles (id, email, full_name, role)
      VALUES (NEW.id, NEW.email, COALESCE(NEW.email, 'Unknown'), 'cashier'::user_role);
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
    RETURN NEW;
END;
$$;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_handle_new_user();
