-- Verification requests and wallet deposits.

-- Añadimos columnas de verificación a users (si no existen)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS verification_requested_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verification_decided_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verification_notes        TEXT;

-- Estado de verificación de un usuario (usado por /me)
CREATE OR REPLACE FUNCTION fn_get_verification_state(p_user_id UUID)
RETURNS TABLE(verified BOOLEAN, verification_requested_at TIMESTAMPTZ, verification_decided_at TIMESTAMPTZ) LANGUAGE sql STABLE AS $$
    SELECT u.verified, u.verification_requested_at, u.verification_decided_at
      FROM users u WHERE u.id = p_user_id;
$$;

-- Usuario pide verificación (si no está verificado)
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

-- Lista de solicitudes pendientes (cualquier rol, no verificados con request)
CREATE OR REPLACE FUNCTION fn_admin_list_pending_verifications()
RETURNS TABLE(
    id UUID,
    email TEXT,
    name TEXT,
    role user_role,
    phone TEXT,
    verification_requested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) LANGUAGE sql STABLE AS $$
    SELECT u.id, u.email, u.name, u.role, u.phone,
           u.verification_requested_at, u.created_at
      FROM users u
     WHERE NOT u.verified
       AND u.verification_requested_at IS NOT NULL
       AND u.role <> 'admin'
     ORDER BY u.verification_requested_at ASC;
$$;

-- Admin aprueba (opcionalmente también valida al agricultor)
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

-- Admin rechaza
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

-- Depósito a la billetera del inversionista (simula transferencia bancaria)
DROP FUNCTION IF EXISTS fn_wallet_deposit(UUID, NUMERIC, TEXT);
CREATE OR REPLACE FUNCTION fn_wallet_deposit(
    p_user_id   UUID,
    p_amount    NUMERIC,
    p_bank_ref  TEXT DEFAULT NULL
)
RETURNS TABLE(tx_id UUID, new_balance NUMERIC) LANGUAGE plpgsql AS $$
DECLARE
    v_role user_role;
    v_tx_id UUID;
    v_balance NUMERIC;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto debe ser positivo';
    END IF;

    SELECT role INTO v_role FROM users WHERE id = p_user_id;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado';
    END IF;

    INSERT INTO wallet_transactions (type, status, from_user_id, to_user_id, amount, description, completed_at)
    VALUES ('deposit', 'completed', NULL, p_user_id, p_amount,
            COALESCE('Depósito simulado · ref ' || p_bank_ref, 'Depósito simulado'), NOW())
    RETURNING id INTO v_tx_id;

    IF v_role = 'investor' THEN
        UPDATE investors SET wallet_balance = wallet_balance + p_amount WHERE user_id = p_user_id
        RETURNING wallet_balance INTO v_balance;
    ELSIF v_role = 'farmer' THEN
        UPDATE farmers SET wallet_balance = wallet_balance + p_amount WHERE user_id = p_user_id
        RETURNING wallet_balance INTO v_balance;
    ELSE
        RAISE EXCEPTION 'Solo inversionistas y agricultores pueden recibir depósitos';
    END IF;

    RETURN QUERY SELECT v_tx_id, v_balance;
END;
$$;
