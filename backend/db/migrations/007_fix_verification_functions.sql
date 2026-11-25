-- Fix ambiguous column references ("id", "verified") in PL/pgSQL functions
-- that use RETURNS TABLE(id UUID, verified BOOLEAN, ...).

CREATE OR REPLACE FUNCTION fn_request_verification(p_user_id UUID)
RETURNS TABLE(id UUID, verified BOOLEAN, verification_requested_at TIMESTAMPTZ) LANGUAGE plpgsql AS $$
BEGIN
    UPDATE users u
       SET verification_requested_at = NOW()
     WHERE u.id = p_user_id AND NOT u.verified;
    RETURN QUERY
       SELECT u.id, u.verified, u.verification_requested_at
         FROM users u WHERE u.id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_admin_approve_verification(p_user_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS TABLE(id UUID, verified BOOLEAN, verification_decided_at TIMESTAMPTZ) LANGUAGE plpgsql AS $$
DECLARE v_role user_role;
BEGIN
    UPDATE users u
       SET verified = TRUE,
           verification_decided_at = NOW(),
           verification_notes = p_notes
     WHERE u.id = p_user_id
    RETURNING u.role INTO v_role;
    IF v_role = 'farmer' THEN
        UPDATE farmers f SET validated = TRUE WHERE f.user_id = p_user_id;
    END IF;
    RETURN QUERY SELECT u.id, u.verified, u.verification_decided_at
                   FROM users u WHERE u.id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_admin_reject_verification(p_user_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS TABLE(id UUID, verified BOOLEAN, verification_decided_at TIMESTAMPTZ) LANGUAGE plpgsql AS $$
BEGIN
    UPDATE users u
       SET verified = FALSE,
           verification_decided_at = NOW(),
           verification_requested_at = NULL,
           verification_notes = p_notes
     WHERE u.id = p_user_id;
    RETURN QUERY SELECT u.id, u.verified, u.verification_decided_at
                   FROM users u WHERE u.id = p_user_id;
END;
$$;
