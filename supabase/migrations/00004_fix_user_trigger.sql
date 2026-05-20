-- ============================================================================
-- Bakala ERP — Fix: user creation trigger
-- The previous trigger failed because casting NULL/invalid string to user_role
-- enum throws an exception before COALESCE can handle it.
-- This version uses explicit NULL/validity checks and SECURITY DEFINER
-- to bypass RLS on the user_profiles table.
-- ============================================================================

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
  -- Safely extract full_name with fallback to email
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NEW.email
  );

  -- Safely extract and cast role with fallback to 'cashier'
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
    -- Never block user creation; default to cashier if anything fails
    BEGIN
      INSERT INTO public.user_profiles (id, email, full_name, role)
      VALUES (NEW.id, NEW.email, COALESCE(NEW.email, 'Unknown'), 'cashier'::user_role);
    EXCEPTION
      WHEN OTHERS THEN
        -- If even the fallback fails (e.g., duplicate), just let the user be created
        NULL;
    END;
    RETURN NEW;
END;
$$;
