-- Admin functions: global metrics, farmer management, validation, auth.

-- Vista del admin (usa solo la tabla users)
DROP VIEW IF EXISTS v_admin CASCADE;
CREATE VIEW v_admin AS
    SELECT u.id, u.email, u.name, u.phone, u.country, u.created_at, u.updated_at
      FROM users u
     WHERE u.role = 'admin';

-- Auth
CREATE OR REPLACE FUNCTION fn_admin_auth_by_email(p_email TEXT)
RETURNS TABLE(
    id UUID, email TEXT, name TEXT, password_hash TEXT
) LANGUAGE sql STABLE AS $$
    SELECT u.id, u.email, u.name, u.password_hash
      FROM users u
     WHERE u.role = 'admin' AND LOWER(u.email) = LOWER(p_email);
$$;

CREATE OR REPLACE FUNCTION fn_admin_get(p_id UUID)
RETURNS SETOF v_admin LANGUAGE sql STABLE AS $$
    SELECT * FROM v_admin WHERE id = p_id;
$$;

-- Creación de admin (usada por el seed)
CREATE OR REPLACE FUNCTION fn_admin_create(
    p_email TEXT, p_password_hash TEXT, p_name TEXT, p_phone TEXT DEFAULT NULL
) RETURNS SETOF v_admin LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
    INSERT INTO users (email, password_hash, role, name, phone)
    VALUES (LOWER(p_email), p_password_hash, 'admin', p_name, p_phone)
    RETURNING id INTO v_id;
    RETURN QUERY SELECT * FROM v_admin WHERE id = v_id;
END;
$$;


-- Métricas globales
CREATE OR REPLACE FUNCTION fn_admin_metrics()
RETURNS TABLE(
    total_users BIGINT,
    total_farmers BIGINT,
    total_investors BIGINT,
    total_allies BIGINT,
    validated_farmers BIGINT,
    pending_farmers BIGINT,
    total_projects BIGINT,
    active_projects BIGINT,
    funded_projects BIGINT,
    completed_projects BIGINT,
    total_invested NUMERIC,
    total_returns_paid NUMERIC,
    total_returns_pending NUMERIC,
    overdue_returns BIGINT
) LANGUAGE sql STABLE AS $$
    SELECT
        (SELECT COUNT(*) FROM users),
        (SELECT COUNT(*) FROM farmers),
        (SELECT COUNT(*) FROM investors),
        (SELECT COUNT(*) FROM allies),
        (SELECT COUNT(*) FROM farmers WHERE validated),
        (SELECT COUNT(*) FROM farmers WHERE NOT validated),
        (SELECT COUNT(*) FROM projects),
        (SELECT COUNT(*) FROM projects WHERE status = 'active'),
        (SELECT COUNT(*) FROM projects WHERE status = 'funded'),
        (SELECT COUNT(*) FROM projects WHERE status = 'completed'),
        COALESCE((SELECT SUM(amount) FROM wallet_transactions
                  WHERE type = 'investment' AND status = 'completed'), 0),
        COALESCE((SELECT SUM(amount) FROM wallet_transactions
                  WHERE type = 'return' AND status = 'completed'), 0),
        COALESCE((SELECT SUM(amount) FROM wallet_transactions
                  WHERE type = 'return' AND status = 'pending'), 0),
        (SELECT COUNT(*) FROM wallet_transactions
         WHERE type = 'return' AND status = 'pending'
           AND scheduled_for < NOW());
$$;

-- Lista completa de agricultores con contadores de proyectos
CREATE OR REPLACE FUNCTION fn_admin_list_farmers()
RETURNS TABLE(
    id UUID,
    email TEXT,
    name TEXT,
    location TEXT,
    crop_type TEXT,
    years_experience INT,
    validated BOOLEAN,
    trust_score INT,
    wallet_balance NUMERIC,
    projects_count BIGINT,
    created_at TIMESTAMPTZ
) LANGUAGE sql STABLE AS $$
    SELECT
        v.id, v.email, v.name, v.location, v.crop_type, v.years_experience,
        v.validated, v.trust_score, v.wallet_balance,
        (SELECT COUNT(*) FROM projects p WHERE p.farmer_id = v.id),
        v.created_at
    FROM v_farmer v
    ORDER BY v.created_at DESC;
$$;

-- Toggle de validación (idempotente, con trust_score ajustable)
CREATE OR REPLACE FUNCTION fn_admin_set_farmer_validation(
    p_id UUID,
    p_validated BOOLEAN,
    p_trust_score INT DEFAULT NULL
)
RETURNS SETOF v_farmer LANGUAGE plpgsql AS $$
BEGIN
    UPDATE farmers
       SET validated = p_validated,
           trust_score = COALESCE(p_trust_score, trust_score)
     WHERE user_id = p_id;
    RETURN QUERY SELECT * FROM v_farmer WHERE id = p_id;
END;
$$;
