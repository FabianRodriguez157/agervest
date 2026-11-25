-- Ensure rejecting a farmer's verification also clears farmers.validated
CREATE OR REPLACE FUNCTION fn_admin_reject_verification(p_user_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS TABLE(id UUID, verified BOOLEAN, verification_decided_at TIMESTAMPTZ) LANGUAGE plpgsql AS $$
DECLARE v_role user_role;
BEGIN
    UPDATE users u
       SET verified = FALSE,
           verification_decided_at = NOW(),
           verification_requested_at = NULL,
           verification_notes = p_notes
     WHERE u.id = p_user_id
    RETURNING u.role INTO v_role;
    IF v_role = 'farmer' THEN
        UPDATE farmers f SET validated = FALSE WHERE f.user_id = p_user_id;
    END IF;
    RETURN QUERY SELECT u.id, u.verified, u.verification_decided_at
                   FROM users u WHERE u.id = p_user_id;
END;
$$;
