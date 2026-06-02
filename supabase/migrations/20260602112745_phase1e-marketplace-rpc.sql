-- Phase 1e: Marketplace RPC functions (user-scoped, not workspace-scoped)

------------------------------------------------------------------------
-- 1) api_list_candidates
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_list_candidates(
  p_role         text DEFAULT NULL,
  p_availability text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(json_agg(
    json_build_object(
      'id', tp.id,
      'display_code', tp.display_code,
      'role', tp.role,
      'exam_score', tp.exam_score,
      'experience_years', tp.experience_years,
      'previous_industries', tp.previous_industries,
      'skills', tp.skills,
      'languages', tp.languages,
      'hourly_rate', tp.hourly_rate,
      'availability', tp.availability,
      'tools_experience', tp.tools_experience,
      'about', tp.about,
      'verified_at', tp.verified_at
    ) ORDER BY tp.exam_score DESC
  ), '[]'::json) INTO v_result
  FROM talent_profiles tp
  WHERE tp.visible = true
    AND (p_role IS NULL OR tp.role = p_role)
    AND (p_availability IS NULL OR tp.availability = p_availability);

  RETURN json_build_object('candidates', v_result);
END;
$$;

------------------------------------------------------------------------
-- 2) api_get_candidate
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_candidate(p_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_build_object(
    'id', tp.id,
    'display_code', tp.display_code,
    'role', tp.role,
    'exam_score', tp.exam_score,
    'experience_years', tp.experience_years,
    'previous_industries', tp.previous_industries,
    'skills', tp.skills,
    'languages', tp.languages,
    'hourly_rate', tp.hourly_rate,
    'availability', tp.availability,
    'tools_experience', tp.tools_experience,
    'about', tp.about,
    'verified_at', tp.verified_at
  ) INTO v_result
  FROM talent_profiles tp
  WHERE tp.id = p_id AND tp.visible = true;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Candidate not found' USING HINT = 'not_found';
  END IF;

  RETURN json_build_object('candidate', v_result);
END;
$$;

------------------------------------------------------------------------
-- 3) api_get_marketplace_profile
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_marketplace_profile()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result json;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT row_to_json(tp) INTO v_result
  FROM talent_profiles tp
  WHERE tp.user_id = v_uid;

  RETURN json_build_object('profile', v_result);
END;
$$;

------------------------------------------------------------------------
-- 4) api_save_marketplace_profile
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_save_marketplace_profile(
  p_photo_url            text DEFAULT NULL,
  p_experience_years     int  DEFAULT NULL,
  p_previous_industries  text[] DEFAULT NULL,
  p_skills               text[] DEFAULT NULL,
  p_languages            text[] DEFAULT NULL,
  p_hourly_rate          numeric DEFAULT NULL,
  p_availability         text DEFAULT NULL,
  p_tools_experience     text[] DEFAULT NULL,
  p_about                text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_exam       record;
  v_profile_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT exam_status, exam_type_taken, exam_score
  INTO v_exam
  FROM profiles WHERE id = v_uid;

  IF v_exam IS NULL OR v_exam.exam_status IS NULL OR v_exam.exam_status = 'not_started' THEN
    RAISE EXCEPTION 'You must pass an exam before creating a profile.'
      USING HINT = 'exam_required';
  END IF;

  INSERT INTO talent_profiles (
    user_id, role, exam_score, exam_type,
    photo_url, experience_years, previous_industries,
    skills, languages, hourly_rate, availability,
    tools_experience, about, visible, updated_at
  )
  VALUES (
    v_uid, v_exam.exam_type_taken, v_exam.exam_score, v_exam.exam_type_taken,
    p_photo_url, p_experience_years, p_previous_industries,
    p_skills, p_languages, p_hourly_rate, p_availability,
    p_tools_experience, p_about, false, now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    photo_url            = EXCLUDED.photo_url,
    experience_years     = EXCLUDED.experience_years,
    previous_industries  = EXCLUDED.previous_industries,
    skills               = EXCLUDED.skills,
    languages            = EXCLUDED.languages,
    hourly_rate          = EXCLUDED.hourly_rate,
    availability         = EXCLUDED.availability,
    tools_experience     = EXCLUDED.tools_experience,
    about                = EXCLUDED.about,
    updated_at           = now()
  RETURNING id INTO v_profile_id;

  RETURN json_build_object('success', true, 'profile_id', v_profile_id);
END;
$$;

------------------------------------------------------------------------
-- 5) api_purchase_candidate
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_purchase_candidate(
  p_talent_profile_id uuid,
  p_include_trainer   boolean DEFAULT false,
  p_company_name      text DEFAULT NULL,
  p_contact_name      text DEFAULT NULL,
  p_contact_phone     text DEFAULT NULL,
  p_notes             text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_candidate     record;
  v_existing_id   uuid;
  v_placement_fee int := 299;
  v_trainer_fee   int := CASE WHEN p_include_trainer THEN 199 ELSE 0 END;
  v_total         int;
  v_purchase_id   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify candidate
  SELECT id, display_code, role, hourly_rate
  INTO v_candidate
  FROM talent_profiles
  WHERE id = p_talent_profile_id AND visible = true;

  IF v_candidate IS NULL THEN
    RAISE EXCEPTION 'Candidate not found or no longer available'
      USING HINT = 'not_found';
  END IF;

  -- Check not already purchased
  SELECT id INTO v_existing_id
  FROM talent_purchases
  WHERE client_user_id = v_uid
    AND talent_profile_id = p_talent_profile_id
    AND payment_status IN ('pending', 'paid')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'You have already requested this candidate.'
      USING HINT = 'duplicate';
  END IF;

  v_total := v_placement_fee + v_trainer_fee;

  INSERT INTO talent_purchases (
    client_user_id, talent_profile_id, include_trainer,
    placement_fee, trainer_fee, total_amount,
    payment_status, status, notes
  )
  VALUES (
    v_uid, p_talent_profile_id, COALESCE(p_include_trainer, false),
    v_placement_fee, v_trainer_fee, v_total,
    'pending', 'pending',
    json_build_object(
      'company_name', p_company_name,
      'contact_name', p_contact_name,
      'contact_phone', p_contact_phone,
      'notes', p_notes
    )::text
  )
  RETURNING id INTO v_purchase_id;

  RETURN json_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'total_amount', v_total,
    'placement_fee', v_placement_fee,
    'trainer_fee', v_trainer_fee,
    'message', format(
      'Your request for %s has been received. The Lynq team will contact you within 24 hours to finalize payment and onboarding.',
      v_candidate.display_code
    )
  );
END;
$$;

------------------------------------------------------------------------
-- Grants
------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION api_list_candidates(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_get_candidate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_get_marketplace_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION api_save_marketplace_profile(text, int, text[], text[], text[], numeric, text, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_purchase_candidate(uuid, boolean, text, text, text, text) TO authenticated;
