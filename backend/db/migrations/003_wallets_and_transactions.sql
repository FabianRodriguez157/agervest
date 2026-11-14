-- =====================================================================
-- AgerVest — Billeteras reales y libro mayor de transacciones
-- =====================================================================
-- * Agricultores reciben el dinero al momento de la inversión.
-- * El retorno al inversionista queda programado (scheduled_for) según la
--   duración del proyecto y se paga automáticamente cuando vence o cuando
--   el proyecto se liquida manualmente.
-- * Toda la lógica de movimiento de saldos vive en funciones PL/pgSQL.
-- =====================================================================

-- --------------------------------------------------------------------
-- Enums
-- --------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM (
        'investment',   -- inversor → agricultor
        'return',       -- agricultor → inversor (capital + ganancia)
        'deposit',      -- recarga externa a billetera
        'withdrawal'    -- retiro externo
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------------------------------------------------------------------
-- Wallet para agricultores
-- --------------------------------------------------------------------
ALTER TABLE farmers
    ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(14,2) NOT NULL DEFAULT 0
        CHECK (wallet_balance >= 0);

-- --------------------------------------------------------------------
-- Libro mayor
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            transaction_type   NOT NULL,
    status          transaction_status NOT NULL DEFAULT 'pending',
    from_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    to_user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    project_id      UUID REFERENCES projects(id)    ON DELETE SET NULL,
    investment_id   UUID REFERENCES investments(id) ON DELETE SET NULL,
    amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    description     TEXT,
    scheduled_for   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tx_from         ON wallet_transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_tx_to           ON wallet_transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_tx_project      ON wallet_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_tx_investment   ON wallet_transactions(investment_id);
CREATE INDEX IF NOT EXISTS idx_tx_pending_due  ON wallet_transactions(status, scheduled_for)
    WHERE status = 'pending';

-- --------------------------------------------------------------------
-- Vista v_farmer actualizada (incluye wallet_balance)
-- --------------------------------------------------------------------
DROP VIEW IF EXISTS v_farmer CASCADE;
CREATE VIEW v_farmer AS
SELECT  u.id, u.email, u.role, u.name, u.phone, u.country,
        u.verified, u.terms_accepted, u.created_at, u.updated_at,
        f.location, f.crop_type, f.area_ha, f.document_id, f.document_url,
        f.years_experience, f.certifications, f.bank_account, f.payment_method,
        f.agricultural_certified, f.validated, f.trust_score, f.avatar_seed,
        f.wallet_balance
FROM users u
JOIN farmers f ON f.user_id = u.id
WHERE u.role = 'farmer';

-- Recrea funciones que dependen de v_farmer (DROP primero porque cambia el tipo de retorno)
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT oid::regprocedure::text AS sig
        FROM pg_proc
        WHERE proname IN (
            'fn_farmer_get', 'fn_farmer_list', 'fn_farmer_auth_by_email',
            'fn_farmer_mark_validated', 'fn_farmer_create'
        )
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE';
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION fn_farmer_get(p_id UUID)
RETURNS SETOF v_farmer LANGUAGE sql STABLE AS $$
    SELECT * FROM v_farmer WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION fn_farmer_list()
RETURNS SETOF v_farmer LANGUAGE sql STABLE AS $$
    SELECT * FROM v_farmer ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION fn_farmer_auth_by_email(p_email TEXT)
RETURNS TABLE(
    id UUID, email TEXT, role user_role, name TEXT, phone TEXT, country TEXT,
    verified BOOLEAN, terms_accepted BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
    location TEXT, crop_type TEXT, area_ha NUMERIC, document_id TEXT, document_url TEXT,
    years_experience INT, certifications TEXT[], bank_account TEXT,
    payment_method farmer_payment_method, agricultural_certified BOOLEAN,
    validated BOOLEAN, trust_score INT, avatar_seed TEXT, wallet_balance NUMERIC,
    password_hash TEXT
) LANGUAGE sql STABLE AS $$
    SELECT v.*, u.password_hash
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
        agricultural_certified, validated, trust_score, avatar_seed, wallet_balance)
    VALUES (v_user_id, p_location, p_crop_type, p_area_ha, p_document_id, p_document_url,
        COALESCE(p_years_experience,0), COALESCE(p_certifications,'{}'::text[]),
        p_bank_account, COALESCE(p_payment_method,'bank_transfer'),
        COALESCE(p_agricultural_certified,FALSE), FALSE, 60,
        REGEXP_REPLACE(p_name,'\s+','','g'), 0);

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
-- fn_invest reescrita: movimiento real de dinero + retorno programado
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_invest(
    p_investor_id UUID, p_project_id UUID, p_amount NUMERIC
) RETURNS SETOF investments LANGUAGE plpgsql AS $$
DECLARE
    v_investor_verified BOOLEAN;
    v_investor_balance  NUMERIC(14,2);
    v_project           projects%ROWTYPE;
    v_token             tokens%ROWTYPE;
    v_farmer_id         UUID;
    v_tokens            NUMERIC(14,4);
    v_expected_return   NUMERIC(14,2);
    v_investment_id     UUID;
    v_updated_rows      INT;
    v_scheduled_for     TIMESTAMPTZ;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Monto inválido';
    END IF;

    -- Bloquea el saldo del inversor
    SELECT i.wallet_balance, u.verified
      INTO v_investor_balance, v_investor_verified
      FROM investors i JOIN users u ON u.id = i.user_id
     WHERE i.user_id = p_investor_id
     FOR UPDATE OF i;
    IF NOT FOUND THEN RAISE EXCEPTION 'Investor not found'; END IF;
    IF NOT v_investor_verified THEN
        RAISE EXCEPTION 'Debes completar la verificación antes de invertir';
    END IF;
    IF p_amount > v_investor_balance THEN
        RAISE EXCEPTION 'Saldo insuficiente en la billetera';
    END IF;

    SELECT * INTO v_project FROM projects WHERE id = p_project_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
    v_farmer_id := v_project.farmer_id;

    SELECT * INTO v_token FROM tokens WHERE project_id = p_project_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Token not found'; END IF;

    v_tokens         := ROUND(p_amount / v_token.price, 4);
    v_expected_return := ROUND(p_amount * (1 + v_project.expected_return_pct / 100.0), 2);
    v_scheduled_for   := NOW() + (v_project.duration_months || ' months')::INTERVAL;

    -- Avanza amount_raised con guard de sobre-financiamiento
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

    -- MOVIMIENTO REAL: debita inversor, acredita agricultor
    UPDATE investors SET wallet_balance = wallet_balance - p_amount WHERE user_id = p_investor_id;
    UPDATE farmers   SET wallet_balance = wallet_balance + p_amount WHERE user_id = v_farmer_id;

    UPDATE tokens SET circulating = circulating + v_tokens WHERE project_id = p_project_id;

    INSERT INTO investments(investor_id, project_id, amount, tokens_acquired, expected_return)
    VALUES (p_investor_id, p_project_id, p_amount, v_tokens, v_expected_return)
    RETURNING id INTO v_investment_id;

    -- Ledger: inversión completada (inversor → agricultor)
    INSERT INTO wallet_transactions(
        type, status, from_user_id, to_user_id, project_id, investment_id,
        amount, description, completed_at
    ) VALUES (
        'investment', 'completed', p_investor_id, v_farmer_id, p_project_id, v_investment_id,
        p_amount, 'Inversión en "' || v_project.title || '"', NOW()
    );

    -- Ledger: retorno programado (agricultor → inversor, al vencimiento)
    INSERT INTO wallet_transactions(
        type, status, from_user_id, to_user_id, project_id, investment_id,
        amount, description, scheduled_for
    ) VALUES (
        'return', 'pending', v_farmer_id, p_investor_id, p_project_id, v_investment_id,
        v_expected_return,
        'Retorno esperado de "' || v_project.title || '" (' ||
            v_project.duration_months || ' meses, ' ||
            v_project.expected_return_pct || '% ROI)',
        v_scheduled_for
    );

    RETURN QUERY SELECT * FROM investments WHERE id = v_investment_id;
END;
$$;

-- =====================================================================
-- Pago de un retorno pendiente
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_pay_investment_return(p_transaction_id UUID)
RETURNS SETOF wallet_transactions LANGUAGE plpgsql AS $$
DECLARE
    v_tx          wallet_transactions%ROWTYPE;
    v_farmer_bal  NUMERIC(14,2);
BEGIN
    SELECT * INTO v_tx FROM wallet_transactions
     WHERE id = p_transaction_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
    IF v_tx.status <> 'pending' THEN
        RAISE EXCEPTION 'La transacción ya está en estado %', v_tx.status;
    END IF;
    IF v_tx.type <> 'return' THEN
        RAISE EXCEPTION 'Solo se pueden liquidar transacciones de tipo return';
    END IF;

    SELECT wallet_balance INTO v_farmer_bal
      FROM farmers WHERE user_id = v_tx.from_user_id FOR UPDATE;

    IF v_farmer_bal < v_tx.amount THEN
        -- Si el agricultor no tiene fondos aún, deja la transacción como pendiente
        -- y RAISE para que el llamador decida (sigue intentando luego)
        RAISE EXCEPTION 'El agricultor no tiene saldo suficiente para liquidar el retorno (requerido %, disponible %)', v_tx.amount, v_farmer_bal;
    END IF;

    UPDATE farmers   SET wallet_balance = wallet_balance - v_tx.amount WHERE user_id = v_tx.from_user_id;
    UPDATE investors SET wallet_balance = wallet_balance + v_tx.amount WHERE user_id = v_tx.to_user_id;

    UPDATE wallet_transactions
       SET status = 'completed', completed_at = NOW()
     WHERE id = p_transaction_id;

    RETURN QUERY SELECT * FROM wallet_transactions WHERE id = p_transaction_id;
END;
$$;

-- =====================================================================
-- Procesa todos los retornos vencidos con saldo disponible
-- Devuelve el número de transacciones liquidadas
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_process_due_returns()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    r RECORD;
    v_paid INT := 0;
BEGIN
    FOR r IN
        SELECT id FROM wallet_transactions
         WHERE status = 'pending' AND type = 'return'
           AND scheduled_for <= NOW()
         ORDER BY scheduled_for
    LOOP
        BEGIN
            PERFORM fn_pay_investment_return(r.id);
            v_paid := v_paid + 1;
        EXCEPTION WHEN OTHERS THEN
            -- Agricultor sin fondos: deja pendiente, continúa con el siguiente
            NULL;
        END;
    END LOOP;
    RETURN v_paid;
END;
$$;

-- =====================================================================
-- Liquida manualmente todos los retornos pendientes de un proyecto
-- (modo demo: fuerza vencimiento aunque la fecha no se haya cumplido)
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_settle_project(p_project_id UUID)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    r RECORD;
    v_paid INT := 0;
BEGIN
    FOR r IN
        SELECT id FROM wallet_transactions
         WHERE project_id = p_project_id AND status = 'pending' AND type = 'return'
         ORDER BY created_at
    LOOP
        BEGIN
            PERFORM fn_pay_investment_return(r.id);
            v_paid := v_paid + 1;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
    RETURN v_paid;
END;
$$;

-- =====================================================================
-- Transacciones de un usuario (como origen o destino)
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_wallet_transactions_for_user(p_user_id UUID)
RETURNS TABLE(
    id UUID, type transaction_type, status transaction_status,
    from_user_id UUID, from_user_name TEXT,
    to_user_id UUID, to_user_name TEXT,
    project_id UUID, project_title TEXT,
    investment_id UUID, amount NUMERIC, description TEXT,
    scheduled_for TIMESTAMPTZ, created_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
    direction TEXT
) LANGUAGE sql STABLE AS $$
    SELECT t.id, t.type, t.status,
           t.from_user_id, uf.name AS from_user_name,
           t.to_user_id,   ut.name AS to_user_name,
           t.project_id, p.title AS project_title,
           t.investment_id, t.amount, t.description,
           t.scheduled_for, t.created_at, t.completed_at,
           CASE
             WHEN t.to_user_id   = p_user_id THEN 'in'
             WHEN t.from_user_id = p_user_id THEN 'out'
             ELSE 'other'
           END AS direction
      FROM wallet_transactions t
      LEFT JOIN users uf ON uf.id = t.from_user_id
      LEFT JOIN users ut ON ut.id = t.to_user_id
      LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.from_user_id = p_user_id OR t.to_user_id = p_user_id
     ORDER BY COALESCE(t.completed_at, t.created_at) DESC;
$$;

-- =====================================================================
-- Resumen de retornos pendientes para un inversionista
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_pending_returns_for_investor(p_investor_id UUID)
RETURNS TABLE(
    transaction_id UUID, project_id UUID, project_title TEXT,
    investment_id UUID, amount NUMERIC, scheduled_for TIMESTAMPTZ,
    days_remaining INT
) LANGUAGE sql STABLE AS $$
    SELECT t.id, t.project_id, p.title,
           t.investment_id, t.amount, t.scheduled_for,
           GREATEST(0, EXTRACT(DAY FROM t.scheduled_for - NOW())::INT)
      FROM wallet_transactions t
      LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.to_user_id = p_investor_id
       AND t.type = 'return' AND t.status = 'pending'
     ORDER BY t.scheduled_for;
$$;

-- =====================================================================
-- Resumen de retornos por pagar para un agricultor
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_pending_obligations_for_farmer(p_farmer_id UUID)
RETURNS TABLE(
    transaction_id UUID, project_id UUID, project_title TEXT,
    investor_id UUID, investor_name TEXT,
    amount NUMERIC, scheduled_for TIMESTAMPTZ,
    days_until_due INT
) LANGUAGE sql STABLE AS $$
    SELECT t.id, t.project_id, p.title,
           t.to_user_id, u.name,
           t.amount, t.scheduled_for,
           EXTRACT(DAY FROM t.scheduled_for - NOW())::INT
      FROM wallet_transactions t
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u    ON u.id = t.to_user_id
     WHERE t.from_user_id = p_farmer_id
       AND t.type = 'return' AND t.status = 'pending'
     ORDER BY t.scheduled_for;
$$;
