-- =====================================================================
-- AgerVest — Vistas, funciones y índices adicionales
-- Toda la lógica SQL vive en la base de datos. El backend solo invoca
-- funciones (SELECT * FROM fn_xxx(...)).
-- =====================================================================

-- --------------------------------------------------------------------
-- Índices adicionales
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_investments_investor_project
    ON investments(investor_id, project_id);

CREATE INDEX IF NOT EXISTS idx_investments_project_investor
    ON investments(project_id, investor_id);

CREATE INDEX IF NOT EXISTS idx_projects_status_featured
    ON projects(status, featured);

CREATE INDEX IF NOT EXISTS idx_projects_title_lower
    ON projects(LOWER(title));

CREATE INDEX IF NOT EXISTS idx_projects_location_lower
    ON projects(LOWER(location));

-- --------------------------------------------------------------------
-- Vistas: perfiles unidos a users
-- --------------------------------------------------------------------
CREATE OR REPLACE VIEW v_farmer AS
SELECT  u.id, u.email, u.role, u.name, u.phone, u.country,
        u.verified, u.terms_accepted, u.created_at, u.updated_at,
        f.location, f.crop_type, f.area_ha, f.document_id, f.document_url,
        f.years_experience, f.certifications, f.bank_account, f.payment_method,
        f.agricultural_certified, f.validated, f.trust_score, f.avatar_seed
FROM users u
JOIN farmers f ON f.user_id = u.id
WHERE u.role = 'farmer';

CREATE OR REPLACE VIEW v_investor AS
SELECT  u.id, u.email, u.role, u.name, u.phone, u.country,
        u.verified, u.terms_accepted, u.created_at, u.updated_at,
        i.document_id, i.document_id_type, i.occupation,
        i.investment_experience, i.investment_frequency, i.investment_budget,
        i.risk_profile, i.bank_account, i.payment_method,
        i.wallet_balance, i.risk_acknowledgment
FROM users u
JOIN investors i ON i.user_id = u.id
WHERE u.role = 'investor';

CREATE OR REPLACE VIEW v_ally AS
SELECT  u.id, u.email, u.role, u.name, u.phone, u.country,
        u.verified, u.terms_accepted, u.created_at, u.updated_at,
        a.organization, a.role_description
FROM users u
JOIN allies a ON a.user_id = u.id
WHERE u.role = 'ally';

-- =====================================================================
-- FARMERS
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_farmer_get(p_id UUID)
RETURNS SETOF v_farmer LANGUAGE sql STABLE AS $$
    SELECT * FROM v_farmer WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION fn_farmer_list()
RETURNS SETOF v_farmer LANGUAGE sql STABLE AS $$
    SELECT * FROM v_farmer ORDER BY created_at DESC;
$$;

-- Devuelve el perfil + password_hash para login
CREATE OR REPLACE FUNCTION fn_farmer_auth_by_email(p_email TEXT)
RETURNS TABLE(
    id UUID, email TEXT, role user_role, name TEXT, phone TEXT, country TEXT,
    verified BOOLEAN, terms_accepted BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
    location TEXT, crop_type TEXT, area_ha NUMERIC, document_id TEXT, document_url TEXT,
    years_experience INT, certifications TEXT[], bank_account TEXT,
    payment_method farmer_payment_method, agricultural_certified BOOLEAN,
    validated BOOLEAN, trust_score INT, avatar_seed TEXT, password_hash TEXT
) LANGUAGE sql STABLE AS $$
    SELECT  v.*, u.password_hash
    FROM v_farmer v JOIN users u ON u.id = v.id
    WHERE LOWER(v.email) = LOWER(p_email);
$$;

CREATE OR REPLACE FUNCTION fn_farmer_create(
    p_email TEXT, p_password_hash TEXT, p_name TEXT, p_phone TEXT, p_country TEXT,
    p_location TEXT, p_crop_type TEXT, p_area_ha NUMERIC, p_document_id TEXT,
    p_document_url TEXT, p_years_experience INT, p_certifications TEXT[],
    p_bank_account TEXT, p_payment_method farmer_payment_method,
    p_agricultural_certified BOOLEAN, p_terms_accepted BOOLEAN
) RETURNS SETOF v_farmer LANGUAGE plpgsql AS $$
DECLARE
    v_user_id UUID;
BEGIN
    INSERT INTO users(email, password_hash, role, name, phone, country, terms_accepted)
    VALUES (p_email, p_password_hash, 'farmer', p_name, p_phone, COALESCE(p_country,'PE'), p_terms_accepted)
    RETURNING id INTO v_user_id;

    INSERT INTO farmers(user_id, location, crop_type, area_ha, document_id, document_url,
        years_experience, certifications, bank_account, payment_method,
        agricultural_certified, validated, trust_score, avatar_seed)
    VALUES (v_user_id, p_location, p_crop_type, p_area_ha, p_document_id, p_document_url,
        COALESCE(p_years_experience,0), COALESCE(p_certifications,'{}'::text[]),
        p_bank_account, COALESCE(p_payment_method,'bank_transfer'),
        COALESCE(p_agricultural_certified,FALSE), FALSE, 60,
        REGEXP_REPLACE(p_name,'\s+','','g'));

    RETURN QUERY SELECT * FROM v_farmer WHERE id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_farmer_mark_validated(p_id UUID)
RETURNS SETOF v_farmer LANGUAGE plpgsql AS $$
BEGIN
    UPDATE farmers
       SET validated = TRUE,
           trust_score = LEAST(100, trust_score + 25)
     WHERE user_id = p_id;
    RETURN QUERY SELECT * FROM v_farmer WHERE id = p_id;
END;
$$;

-- =====================================================================
-- INVESTORS
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_investor_get(p_id UUID)
RETURNS SETOF v_investor LANGUAGE sql STABLE AS $$
    SELECT * FROM v_investor WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION fn_investor_auth_by_email(p_email TEXT)
RETURNS TABLE(
    id UUID, email TEXT, role user_role, name TEXT, phone TEXT, country TEXT,
    verified BOOLEAN, terms_accepted BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
    document_id TEXT, document_id_type id_document_type, occupation TEXT,
    investment_experience investment_experience, investment_frequency investment_frequency,
    investment_budget NUMERIC, risk_profile risk_profile, bank_account TEXT,
    payment_method investor_payment_method, wallet_balance NUMERIC,
    risk_acknowledgment BOOLEAN, password_hash TEXT
) LANGUAGE sql STABLE AS $$
    SELECT v.*, u.password_hash
    FROM v_investor v JOIN users u ON u.id = v.id
    WHERE LOWER(v.email) = LOWER(p_email);
$$;

CREATE OR REPLACE FUNCTION fn_investor_create(
    p_email TEXT, p_password_hash TEXT, p_name TEXT, p_phone TEXT, p_country TEXT,
    p_document_id TEXT, p_document_id_type id_document_type, p_occupation TEXT,
    p_investment_experience investment_experience,
    p_investment_frequency investment_frequency,
    p_investment_budget NUMERIC, p_risk_profile risk_profile,
    p_bank_account TEXT, p_payment_method investor_payment_method,
    p_terms_accepted BOOLEAN, p_risk_acknowledgment BOOLEAN
) RETURNS SETOF v_investor LANGUAGE plpgsql AS $$
DECLARE
    v_user_id UUID;
    v_wallet  NUMERIC(14,2);
BEGIN
    v_wallet := GREATEST(5000, COALESCE(p_investment_budget, 0));

    INSERT INTO users(email, password_hash, role, name, phone, country, terms_accepted)
    VALUES (p_email, p_password_hash, 'investor', p_name, p_phone, COALESCE(p_country,'PE'), p_terms_accepted)
    RETURNING id INTO v_user_id;

    INSERT INTO investors(user_id, document_id, document_id_type, occupation,
        investment_experience, investment_frequency, investment_budget, risk_profile,
        bank_account, payment_method, wallet_balance, risk_acknowledgment)
    VALUES (v_user_id, p_document_id, COALESCE(p_document_id_type,'DNI'),
        p_occupation, COALESCE(p_investment_experience,'none'),
        COALESCE(p_investment_frequency,'sporadic'),
        COALESCE(p_investment_budget,0), COALESCE(p_risk_profile,'moderado'),
        p_bank_account, COALESCE(p_payment_method,'bank_transfer'),
        v_wallet, p_risk_acknowledgment);

    RETURN QUERY SELECT * FROM v_investor WHERE id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_investor_verify(
    p_id UUID, p_document_id TEXT, p_phone TEXT, p_bank_account TEXT
) RETURNS SETOF v_investor LANGUAGE plpgsql AS $$
BEGIN
    UPDATE investors
       SET document_id  = COALESCE(p_document_id, document_id),
           bank_account = COALESCE(p_bank_account, bank_account)
     WHERE user_id = p_id;

    UPDATE users
       SET phone    = COALESCE(p_phone, phone),
           verified = TRUE
     WHERE id = p_id;

    RETURN QUERY SELECT * FROM v_investor WHERE id = p_id;
END;
$$;

-- =====================================================================
-- ALLIES
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_ally_get(p_id UUID)
RETURNS SETOF v_ally LANGUAGE sql STABLE AS $$
    SELECT * FROM v_ally WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION fn_ally_auth_by_email(p_email TEXT)
RETURNS TABLE(
    id UUID, email TEXT, role user_role, name TEXT, phone TEXT, country TEXT,
    verified BOOLEAN, terms_accepted BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
    organization TEXT, role_description TEXT, password_hash TEXT
) LANGUAGE sql STABLE AS $$
    SELECT v.*, u.password_hash
    FROM v_ally v JOIN users u ON u.id = v.id
    WHERE LOWER(v.email) = LOWER(p_email);
$$;

CREATE OR REPLACE FUNCTION fn_ally_create(
    p_email TEXT, p_password_hash TEXT, p_name TEXT, p_phone TEXT, p_country TEXT,
    p_organization TEXT, p_role_description TEXT, p_terms_accepted BOOLEAN
) RETURNS SETOF v_ally LANGUAGE plpgsql AS $$
DECLARE
    v_user_id UUID;
BEGIN
    INSERT INTO users(email, password_hash, role, name, phone, country, terms_accepted)
    VALUES (p_email, p_password_hash, 'ally', p_name, p_phone, COALESCE(p_country,'PE'), p_terms_accepted)
    RETURNING id INTO v_user_id;

    INSERT INTO allies(user_id, organization, role_description)
    VALUES (v_user_id, p_organization, p_role_description);

    RETURN QUERY SELECT * FROM v_ally WHERE id = v_user_id;
END;
$$;

-- =====================================================================
-- PROJECTS
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_project_get(p_id UUID)
RETURNS SETOF projects LANGUAGE sql STABLE AS $$
    SELECT * FROM projects WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION fn_project_list_by_farmer(p_farmer_id UUID)
RETURNS SETOF projects LANGUAGE sql STABLE AS $$
    SELECT * FROM projects WHERE farmer_id = p_farmer_id ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION fn_project_list(
    p_crop TEXT, p_risk TEXT, p_status TEXT, p_q TEXT
) RETURNS SETOF projects LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM projects
    WHERE (p_crop   IS NULL OR LOWER(crop) = LOWER(p_crop))
      AND (p_risk   IS NULL OR risk::text  = p_risk)
      AND (p_status IS NULL OR status::text = p_status)
      AND (p_q      IS NULL OR
           LOWER(title)    LIKE '%' || LOWER(p_q) || '%' OR
           LOWER(crop)     LIKE '%' || LOWER(p_q) || '%' OR
           LOWER(location) LIKE '%' || LOWER(p_q) || '%')
    ORDER BY featured DESC, created_at DESC;
END;
$$;

-- Crea proyecto + token en una sola transacción atómica
CREATE OR REPLACE FUNCTION fn_project_create(
    p_farmer_id UUID, p_title TEXT, p_crop TEXT, p_description TEXT,
    p_location TEXT, p_project_area_ha NUMERIC, p_crop_variety TEXT,
    p_investment_needed NUMERIC, p_amount_available NUMERIC,
    p_duration_months INT, p_risk project_risk, p_expected_return_pct NUMERIC,
    p_payment_method project_payment_method, p_objectives TEXT, p_benefits TEXT,
    p_risk_mitigation TEXT, p_has_insurance insurance_status,
    p_prior_experience prior_experience, p_certification certification_type,
    p_technical_support technical_support, p_image_url TEXT, p_document_url TEXT,
    p_featured BOOLEAN, p_terms_accepted BOOLEAN, p_updates_accepted BOOLEAN
) RETURNS SETOF projects LANGUAGE plpgsql AS $$
DECLARE
    v_project_id UUID;
    v_symbol     TEXT;
    v_price      NUMERIC(14,4);
BEGIN
    IF NOT p_terms_accepted   THEN RAISE EXCEPTION 'Debes aceptar los términos del proyecto'; END IF;
    IF NOT p_updates_accepted THEN RAISE EXCEPTION 'Debes comprometerte a proporcionar actualizaciones'; END IF;

    INSERT INTO projects(
        farmer_id, title, crop, description, location, project_area_ha, crop_variety,
        investment_needed, amount_available, duration_months, risk, expected_return_pct,
        payment_method, objectives, benefits, risk_mitigation,
        has_insurance, prior_experience, certification, technical_support,
        image_url, document_url, status, progress, featured,
        terms_accepted, updates_accepted
    ) VALUES (
        p_farmer_id, p_title, p_crop, p_description, p_location, p_project_area_ha, p_crop_variety,
        p_investment_needed, COALESCE(p_amount_available,0), p_duration_months, p_risk,
        p_expected_return_pct, COALESCE(p_payment_method,'percentage'), p_objectives, p_benefits,
        p_risk_mitigation, COALESCE(p_has_insurance,'no'),
        COALESCE(p_prior_experience,'assisted'), COALESCE(p_certification,'conventional'),
        COALESCE(p_technical_support,'own_experience'), p_image_url, p_document_url,
        'active', 0, COALESCE(p_featured,FALSE), p_terms_accepted, p_updates_accepted
    ) RETURNING id INTO v_project_id;

    v_symbol := 'AGV-' || UPPER(SUBSTRING(p_title FROM 1 FOR 3));
    v_price  := ROUND(p_investment_needed / 1000.0, 4);

    INSERT INTO tokens(project_id, symbol, total_supply, price, circulating)
    VALUES (v_project_id, v_symbol, 1000, v_price, 0);

    RETURN QUERY SELECT * FROM projects WHERE id = v_project_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_project_set_featured(p_id UUID, p_featured BOOLEAN)
RETURNS SETOF projects LANGUAGE plpgsql AS $$
BEGIN
    UPDATE projects SET featured = p_featured WHERE id = p_id;
    RETURN QUERY SELECT * FROM projects WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_project_add_update(
    p_project_id UUID, p_message TEXT, p_progress_delta INT, p_image_url TEXT
) RETURNS SETOF project_updates LANGUAGE plpgsql AS $$
DECLARE
    v_update_id UUID;
BEGIN
    INSERT INTO project_updates(project_id, message, progress_delta, image_url)
    VALUES (p_project_id, p_message, COALESCE(p_progress_delta,0), p_image_url)
    RETURNING id INTO v_update_id;

    UPDATE projects
       SET progress = LEAST(100, progress + COALESCE(p_progress_delta,0)),
           status   = CASE WHEN LEAST(100, progress + COALESCE(p_progress_delta,0)) >= 100
                           THEN 'completed'::project_status ELSE status END
     WHERE id = p_project_id;

    RETURN QUERY SELECT * FROM project_updates WHERE id = v_update_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_project_updates(p_project_id UUID)
RETURNS SETOF project_updates LANGUAGE sql STABLE AS $$
    SELECT * FROM project_updates
     WHERE project_id = p_project_id
     ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION fn_token_by_project(p_project_id UUID)
RETURNS SETOF tokens LANGUAGE sql STABLE AS $$
    SELECT * FROM tokens WHERE project_id = p_project_id;
$$;

-- =====================================================================
-- INVESTMENTS (lógica de negocio completa en SQL)
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_invest(
    p_investor_id UUID, p_project_id UUID, p_amount NUMERIC
) RETURNS SETOF investments LANGUAGE plpgsql AS $$
DECLARE
    v_investor       v_investor%ROWTYPE;
    v_project        projects%ROWTYPE;
    v_token          tokens%ROWTYPE;
    v_tokens         NUMERIC(14,4);
    v_expected       NUMERIC(14,2);
    v_investment_id  UUID;
    v_updated_rows   INT;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Monto inválido';
    END IF;

    -- Bloquea el inversionista para evitar carreras sobre el saldo
    SELECT * INTO v_investor FROM v_investor WHERE id = p_investor_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Investor not found';
    END IF;
    IF NOT v_investor.verified THEN
        RAISE EXCEPTION 'Debes completar la verificación antes de invertir';
    END IF;
    IF p_amount > v_investor.wallet_balance THEN
        RAISE EXCEPTION 'Saldo insuficiente en la billetera';
    END IF;

    SELECT * INTO v_project FROM projects WHERE id = p_project_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Project not found';
    END IF;

    SELECT * INTO v_token FROM tokens WHERE project_id = p_project_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Token not found';
    END IF;

    v_tokens   := ROUND(p_amount / v_token.price, 4);
    v_expected := ROUND(p_amount * (1 + v_project.expected_return_pct / 100.0), 2);

    -- Actualiza proyecto con guard para prevenir sobre-financiamiento
    UPDATE projects
       SET amount_raised = amount_raised + p_amount,
           status = CASE WHEN amount_raised + p_amount >= investment_needed
                         THEN 'funded'::project_status ELSE status END
     WHERE id = p_project_id
       AND amount_raised + p_amount <= investment_needed;
    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    IF v_updated_rows = 0 THEN
        RAISE EXCEPTION 'Monto excede el financiamiento restante del proyecto';
    END IF;

    -- Descuenta billetera del inversionista
    UPDATE investors
       SET wallet_balance = wallet_balance - p_amount
     WHERE user_id = p_investor_id;

    -- Incrementa el circulante del token
    UPDATE tokens
       SET circulating = circulating + v_tokens
     WHERE project_id = p_project_id;

    INSERT INTO investments(investor_id, project_id, amount, tokens_acquired, expected_return)
    VALUES (p_investor_id, p_project_id, p_amount, v_tokens, v_expected)
    RETURNING id INTO v_investment_id;

    RETURN QUERY SELECT * FROM investments WHERE id = v_investment_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_investments_by_investor(p_investor_id UUID)
RETURNS SETOF investments LANGUAGE sql STABLE AS $$
    SELECT * FROM investments WHERE investor_id = p_investor_id ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION fn_investments_by_project(p_project_id UUID)
RETURNS SETOF investments LANGUAGE sql STABLE AS $$
    SELECT * FROM investments WHERE project_id = p_project_id ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION fn_investors_count_for_project(p_project_id UUID)
RETURNS INT LANGUAGE sql STABLE AS $$
    SELECT COUNT(DISTINCT investor_id)::int FROM investments WHERE project_id = p_project_id;
$$;

-- =====================================================================
-- DASHBOARDS Y STATS
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_platform_stats()
RETURNS TABLE(
    total_projects   INT,
    total_funded     NUMERIC,
    total_investors  INT,
    total_farmers    INT
) LANGUAGE sql STABLE AS $$
    SELECT
        (SELECT COUNT(*) FROM projects)::INT,
        (SELECT COALESCE(SUM(amount_raised),0) FROM projects),
        (SELECT COUNT(*) FROM investors)::INT,
        (SELECT COUNT(*) FROM farmers)::INT;
$$;

CREATE OR REPLACE FUNCTION fn_farmer_dashboard_totals(p_farmer_id UUID)
RETURNS TABLE(total_raised NUMERIC, active_projects INT)
LANGUAGE sql STABLE AS $$
    SELECT
        COALESCE(SUM(amount_raised),0),
        COUNT(*) FILTER (WHERE status = 'active')::INT
    FROM projects WHERE farmer_id = p_farmer_id;
$$;

CREATE OR REPLACE FUNCTION fn_investor_portfolio_totals(p_investor_id UUID)
RETURNS TABLE(total_invested NUMERIC, total_expected_return NUMERIC, projects_funded INT)
LANGUAGE sql STABLE AS $$
    SELECT
        COALESCE(SUM(amount),0),
        COALESCE(SUM(expected_return),0),
        COUNT(DISTINCT project_id)::INT
    FROM investments WHERE investor_id = p_investor_id;
$$;

CREATE OR REPLACE FUNCTION fn_ally_dashboard_counters()
RETURNS TABLE(
    producers_supported   INT,
    campaigns_under_review INT,
    published_campaigns   INT
) LANGUAGE sql STABLE AS $$
    SELECT
        (SELECT COUNT(*) FROM farmers)::INT,
        (SELECT COUNT(*) FROM projects WHERE status = 'draft')::INT,
        (SELECT COUNT(*) FROM projects WHERE status <> 'draft')::INT;
$$;

CREATE OR REPLACE FUNCTION fn_project_list_all()
RETURNS SETOF projects LANGUAGE sql STABLE AS $$
    SELECT * FROM projects ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION fn_users_count()
RETURNS INT LANGUAGE sql STABLE AS $$
    SELECT COUNT(*)::INT FROM users;
$$;
