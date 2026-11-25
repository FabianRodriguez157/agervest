-- =====================================================================
-- 009 · Modelo "todo o nada" (préstamo de campaña)
--
-- Política:
--  * Cada aporte se RESERVA: sale del saldo libre del inversionista pero no
--    llega al agricultor ni genera comisión.
--  * Cuando la recaudación alcanza la meta se DESEMBOLSA una sola vez:
--      comisión AgerVest = 6% de la recaudación bruta
--      neto al agricultor = 94%
--    y se programan los pagos desde la fecha de desembolso.
--  * Si vence el plazo de captación sin completar la meta, todos los aportes
--    reservados se REEMBOLSAN íntegros. No hay comisión ni deuda.
--  * La tasa del proyecto es la tasa de la CAMPAÑA (del período completo),
--    no una TEA. Pago = capital × (1 + tasa_campaña).
--  * Inversiones anteriores a esta migración conservan sus condiciones
--    (ya desembolsadas): se marcan como 'active'.
--  * Idempotencia: aportes y depósitos aceptan una clave de operación.
-- =====================================================================

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS funding_deadline TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS disbursed_at     TIMESTAMPTZ;

UPDATE projects SET funding_deadline = GREATEST(created_at, NOW()) + INTERVAL '30 days'
 WHERE funding_deadline IS NULL;
ALTER TABLE projects ALTER COLUMN funding_deadline SET DEFAULT (NOW() + INTERVAL '30 days');

-- Proyectos ya financiados antes del cambio: se consideran desembolsados
UPDATE projects SET disbursed_at = updated_at
 WHERE status IN ('funded','in_progress','completed') AND disbursed_at IS NULL;

ALTER TABLE investments
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

DO $$ BEGIN
    ALTER TABLE investments ADD CONSTRAINT chk_investment_status
        CHECK (status IN ('reserved','active','refunded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_investments_idem
    ON investments(investor_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_tx_idem
    ON wallet_transactions(to_user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------
-- Desembolso (interno): comisión + neto + calendario de pagos
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_disburse_project(p_project_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_project   projects%ROWTYPE;
    v_rate      NUMERIC(5,4) := 0.06;
    v_gross     NUMERIC(14,2);
    v_comm      NUMERIC(14,2);
    v_net       NUMERIC(14,2);
    v_due       TIMESTAMPTZ;
    r           RECORD;
BEGIN
    SELECT * INTO v_project FROM projects WHERE id = p_project_id FOR UPDATE;
    IF v_project.disbursed_at IS NOT NULL THEN RETURN; END IF;   -- una sola vez
    IF v_project.amount_raised < v_project.investment_needed THEN
        RAISE EXCEPTION 'La meta aún no se completa';
    END IF;

    v_due := NOW() + (v_project.duration_months || ' months')::INTERVAL;
    v_gross := 0; v_comm := 0;

    FOR r IN SELECT * FROM investments
              WHERE project_id = p_project_id AND status = 'reserved'
              ORDER BY created_at FOR UPDATE
    LOOP
        INSERT INTO platform_earnings(investment_id, project_id, investor_id, farmer_id,
                                      gross_amount, commission_rate, commission, net_to_farmer)
        VALUES (r.id, p_project_id, r.investor_id, v_project.farmer_id,
                r.amount, v_rate, ROUND(r.amount * v_rate, 2), r.amount - ROUND(r.amount * v_rate, 2));

        INSERT INTO wallet_transactions(type, status, from_user_id, to_user_id, project_id,
                                        investment_id, amount, description, scheduled_for)
        VALUES ('return', 'pending', v_project.farmer_id, r.investor_id, p_project_id, r.id,
                r.expected_return,
                'Pago de "' || v_project.title || '" (capital + ' || v_project.expected_return_pct
                    || '% de la campaña, ' || v_project.duration_months || ' meses)',
                v_due);

        UPDATE investments SET status = 'active' WHERE id = r.id;
        v_gross := v_gross + r.amount;
        v_comm  := v_comm + ROUND(r.amount * v_rate, 2);
    END LOOP;

    v_net := v_gross - v_comm;
    UPDATE farmers SET wallet_balance = wallet_balance + v_net WHERE user_id = v_project.farmer_id;

    INSERT INTO wallet_transactions(type, status, from_user_id, to_user_id, project_id,
                                    amount, description, completed_at)
    VALUES ('investment', 'completed', NULL, v_project.farmer_id, p_project_id, v_net,
            'Desembolso de "' || v_project.title || '": meta completa S/ ' || v_gross
                || ' − comisión 6% S/ ' || v_comm, NOW());

    UPDATE projects SET status = 'funded', disbursed_at = NOW(), updated_at = NOW()
     WHERE id = p_project_id;
END;
$$;

-- ---------------------------------------------------------------------
-- Aporte: reserva fondos; desembolsa si con este aporte se completa la meta
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_invest(UUID, UUID, NUMERIC);
CREATE OR REPLACE FUNCTION fn_invest(
    p_investor_id UUID, p_project_id UUID, p_amount NUMERIC, p_idem TEXT DEFAULT NULL
) RETURNS SETOF investments LANGUAGE plpgsql AS $$
DECLARE
    v_verified BOOLEAN;
    v_balance  NUMERIC(14,2);
    v_project  projects%ROWTYPE;
    v_token    tokens%ROWTYPE;
    v_id       UUID;
BEGIN
    IF p_idem IS NOT NULL THEN
        SELECT id INTO v_id FROM investments WHERE investor_id = p_investor_id AND idempotency_key = p_idem;
        IF FOUND THEN RETURN QUERY SELECT * FROM investments WHERE id = v_id; RETURN; END IF;
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;

    SELECT i.wallet_balance, u.verified INTO v_balance, v_verified
      FROM investors i JOIN users u ON u.id = i.user_id
     WHERE i.user_id = p_investor_id FOR UPDATE OF i;
    IF NOT FOUND THEN RAISE EXCEPTION 'Investor not found'; END IF;
    IF NOT v_verified THEN RAISE EXCEPTION 'Debes completar la verificación antes de invertir'; END IF;
    IF p_amount > v_balance THEN RAISE EXCEPTION 'Saldo insuficiente en la billetera'; END IF;

    SELECT * INTO v_project FROM projects WHERE id = p_project_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
    IF v_project.status <> 'active' OR v_project.disbursed_at IS NOT NULL THEN
        RAISE EXCEPTION 'La campaña no está recibiendo aportes';
    END IF;
    IF v_project.funding_deadline < NOW() THEN
        RAISE EXCEPTION 'El plazo de captación de esta campaña venció';
    END IF;
    IF v_project.amount_raised + p_amount > v_project.investment_needed THEN
        RAISE EXCEPTION 'Monto excede el financiamiento restante del proyecto (faltan S/ %)',
            v_project.investment_needed - v_project.amount_raised;
    END IF;

    SELECT * INTO v_token FROM tokens WHERE project_id = p_project_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Token not found'; END IF;

    UPDATE investors SET wallet_balance = wallet_balance - p_amount WHERE user_id = p_investor_id;
    UPDATE projects  SET amount_raised = amount_raised + p_amount, updated_at = NOW() WHERE id = p_project_id;
    UPDATE tokens    SET circulating = circulating + ROUND(p_amount / v_token.price, 4) WHERE project_id = p_project_id;

    INSERT INTO investments(investor_id, project_id, amount, tokens_acquired, expected_return, status, idempotency_key)
    VALUES (p_investor_id, p_project_id, p_amount, ROUND(p_amount / v_token.price, 4),
            ROUND(p_amount * (1 + v_project.expected_return_pct / 100.0), 2), 'reserved', p_idem)
    RETURNING id INTO v_id;

    INSERT INTO wallet_transactions(type, status, from_user_id, to_user_id, project_id, investment_id,
                                    amount, description)
    VALUES ('investment', 'pending', p_investor_id, NULL, p_project_id, v_id, p_amount,
            'Aporte reservado en "' || v_project.title || '" (se desembolsa solo si se completa la meta)');

    IF v_project.amount_raised + p_amount >= v_project.investment_needed THEN
        PERFORM fn_disburse_project(p_project_id);
        UPDATE wallet_transactions SET status = 'completed', completed_at = NOW()
         WHERE project_id = p_project_id AND type = 'investment' AND status = 'pending'
           AND investment_id IS NOT NULL;
    END IF;

    RETURN QUERY SELECT * FROM investments WHERE id = v_id;
END;
$$;

-- ---------------------------------------------------------------------
-- Vencimiento: campañas activas con plazo vencido y meta incompleta
-- se cancelan y reembolsan íntegramente. Devuelve campañas cerradas.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_expire_campaigns()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    p RECORD; r RECORD; v_n INT := 0;
BEGIN
    FOR p IN SELECT * FROM projects
              WHERE status = 'active' AND disbursed_at IS NULL
                AND funding_deadline < NOW() AND amount_raised < investment_needed
              FOR UPDATE SKIP LOCKED
    LOOP
        FOR r IN SELECT * FROM investments WHERE project_id = p.id AND status = 'reserved' FOR UPDATE LOOP
            UPDATE investors SET wallet_balance = wallet_balance + r.amount WHERE user_id = r.investor_id;
            UPDATE investments SET status = 'refunded' WHERE id = r.id;
            UPDATE wallet_transactions SET status = 'cancelled'
             WHERE investment_id = r.id AND type = 'investment' AND status = 'pending';
            INSERT INTO wallet_transactions(type, status, from_user_id, to_user_id, project_id,
                                            investment_id, amount, description, completed_at)
            VALUES ('deposit', 'completed', NULL, r.investor_id, p.id, r.id, r.amount,
                    'Reembolso íntegro: "' || p.title || '" no completó la meta a tiempo', NOW());
        END LOOP;
        UPDATE projects SET status = 'cancelled', updated_at = NOW() WHERE id = p.id;
        v_n := v_n + 1;
    END LOOP;
    RETURN v_n;
END;
$$;

-- ---------------------------------------------------------------------
-- Pago de una obligación con control de titularidad
-- p_actor_id / p_actor_role: quien ordena el pago. Un agricultor solo
-- puede pagar sus propias obligaciones. Admin/aliado pueden gestionar cobro.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_pay_return_as(p_transaction_id UUID, p_actor_id UUID, p_actor_role TEXT)
RETURNS SETOF wallet_transactions LANGUAGE plpgsql AS $$
DECLARE v_from UUID;
BEGIN
    SELECT from_user_id INTO v_from FROM wallet_transactions WHERE id = p_transaction_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
    IF p_actor_role = 'farmer' AND v_from IS DISTINCT FROM p_actor_id THEN
        RAISE EXCEPTION 'No puedes pagar una obligación de otro agricultor';
    END IF;
    RETURN QUERY SELECT * FROM fn_pay_investment_return(p_transaction_id);
END;
$$;

-- ---------------------------------------------------------------------
-- Depósito simulado idempotente
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_wallet_deposit_idem(
    p_user_id UUID, p_amount NUMERIC, p_bank_ref TEXT, p_idem TEXT
) RETURNS TABLE(tx_id UUID, new_balance NUMERIC) LANGUAGE plpgsql AS $$
DECLARE v_tx UUID;
BEGIN
    IF p_idem IS NOT NULL THEN
        SELECT id INTO v_tx FROM wallet_transactions WHERE to_user_id = p_user_id AND idempotency_key = p_idem;
        IF FOUND THEN
            RETURN QUERY SELECT v_tx, COALESCE(
                (SELECT wallet_balance FROM investors WHERE user_id = p_user_id),
                (SELECT wallet_balance FROM farmers   WHERE user_id = p_user_id));
            RETURN;
        END IF;
    END IF;
    RETURN QUERY SELECT d.tx_id, d.new_balance FROM fn_wallet_deposit(p_user_id, p_amount, p_bank_ref) d;
    IF p_idem IS NOT NULL THEN
        UPDATE wallet_transactions SET idempotency_key = p_idem
         WHERE id = (SELECT id FROM wallet_transactions WHERE to_user_id = p_user_id AND type = 'deposit'
                      ORDER BY created_at DESC LIMIT 1);
    END IF;
END;
$$;

-- Totales: los aportes reembolsados no cuentan como invertidos
CREATE OR REPLACE FUNCTION fn_investor_portfolio_totals(p_investor_id UUID)
RETURNS TABLE(total_invested NUMERIC, total_expected_return NUMERIC, projects_funded INT)
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(SUM(amount),0), COALESCE(SUM(expected_return),0), COUNT(DISTINCT project_id)::INT
      FROM investments WHERE investor_id = p_investor_id AND status <> 'refunded';
$$;

CREATE OR REPLACE FUNCTION fn_platform_stats()
RETURNS TABLE(total_projects INT, total_funded NUMERIC, total_investors INT, total_farmers INT)
LANGUAGE sql STABLE AS $$
    SELECT (SELECT COUNT(*) FROM projects)::INT,
           (SELECT COALESCE(SUM(amount_raised),0) FROM projects WHERE status <> 'cancelled'),
           (SELECT COUNT(*) FROM investors)::INT,
           (SELECT COUNT(*) FROM farmers)::INT;
$$;
