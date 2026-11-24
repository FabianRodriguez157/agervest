-- AgerVest platform earnings: 6% commission on every investment.
-- El agricultor recibe el 94% del aporte del inversor; el 6% queda como ingreso
-- de la plataforma registrado en platform_earnings (tabla separada para auditoría
-- limpia; wallet_transactions se mantiene como ledger de movimientos al usuario).

CREATE TABLE IF NOT EXISTS platform_earnings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id   UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES projects(id),
    investor_id     UUID NOT NULL REFERENCES users(id),
    farmer_id       UUID NOT NULL REFERENCES users(id),
    gross_amount    NUMERIC(14,2) NOT NULL CHECK (gross_amount > 0),
    commission_rate NUMERIC(5,4)  NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 1),
    commission      NUMERIC(14,2) NOT NULL CHECK (commission >= 0),
    net_to_farmer   NUMERIC(14,2) NOT NULL CHECK (net_to_farmer >= 0),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_earnings_project  ON platform_earnings(project_id);
CREATE INDEX IF NOT EXISTS idx_earnings_investor ON platform_earnings(investor_id);
CREATE INDEX IF NOT EXISTS idx_earnings_created  ON platform_earnings(created_at DESC);

-- Reemplaza fn_invest: 6% de comisión, 94% al agricultor
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
    v_commission_rate   NUMERIC(5,4) := 0.06;
    v_commission        NUMERIC(14,2);
    v_net_to_farmer     NUMERIC(14,2);
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Monto inválido';
    END IF;

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

    v_commission     := ROUND(p_amount * v_commission_rate, 2);
    v_net_to_farmer  := p_amount - v_commission;
    v_tokens         := ROUND(p_amount / v_token.price, 4);
    v_expected_return := ROUND(p_amount * (1 + v_project.expected_return_pct / 100.0), 2);
    v_scheduled_for   := NOW() + (v_project.duration_months || ' months')::INTERVAL;

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

    -- Movimiento: inversor paga p_amount; agricultor recibe 94%; AgerVest retiene 6%
    UPDATE investors SET wallet_balance = wallet_balance - p_amount        WHERE user_id = p_investor_id;
    UPDATE farmers   SET wallet_balance = wallet_balance + v_net_to_farmer WHERE user_id = v_farmer_id;

    UPDATE tokens SET circulating = circulating + v_tokens WHERE project_id = p_project_id;

    INSERT INTO investments(investor_id, project_id, amount, tokens_acquired, expected_return)
    VALUES (p_investor_id, p_project_id, p_amount, v_tokens, v_expected_return)
    RETURNING id INTO v_investment_id;

    INSERT INTO platform_earnings(
        investment_id, project_id, investor_id, farmer_id,
        gross_amount, commission_rate, commission, net_to_farmer
    ) VALUES (
        v_investment_id, p_project_id, p_investor_id, v_farmer_id,
        p_amount, v_commission_rate, v_commission, v_net_to_farmer
    );

    -- Ledger: inversión neta al agricultor
    INSERT INTO wallet_transactions(
        type, status, from_user_id, to_user_id, project_id, investment_id,
        amount, description, completed_at
    ) VALUES (
        'investment', 'completed', p_investor_id, v_farmer_id, p_project_id, v_investment_id,
        v_net_to_farmer,
        'Inversión neta en "' || v_project.title || '" (bruto ' || p_amount || ', comisión ' || v_commission || ')',
        NOW()
    );

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

-- Backfill: inversiones existentes se registran retroactivamente con comisión 6%
INSERT INTO platform_earnings(investment_id, project_id, investor_id, farmer_id,
                               gross_amount, commission_rate, commission, net_to_farmer, created_at)
SELECT i.id, i.project_id, i.investor_id, p.farmer_id,
       i.amount, 0.06, ROUND(i.amount * 0.06, 2), ROUND(i.amount * 0.94, 2), i.created_at
  FROM investments i
  JOIN projects p ON p.id = i.project_id
 WHERE NOT EXISTS (SELECT 1 FROM platform_earnings e WHERE e.investment_id = i.id);

-- Admin: resumen de ingresos de la plataforma
CREATE OR REPLACE FUNCTION fn_admin_earnings_summary()
RETURNS TABLE(
    total_investments BIGINT,
    total_gross NUMERIC,
    total_commission NUMERIC,
    total_net_to_farmers NUMERIC,
    average_commission NUMERIC,
    commission_rate NUMERIC
) LANGUAGE sql STABLE AS $$
    SELECT
        COUNT(*),
        COALESCE(SUM(gross_amount), 0),
        COALESCE(SUM(commission), 0),
        COALESCE(SUM(net_to_farmer), 0),
        COALESCE(AVG(commission), 0),
        0.06::NUMERIC
      FROM platform_earnings;
$$;

-- Admin: ingreso detallado por inversión, con nombres
CREATE OR REPLACE FUNCTION fn_admin_earnings_list()
RETURNS TABLE(
    id UUID,
    investment_id UUID,
    project_id UUID,
    project_title TEXT,
    project_crop TEXT,
    investor_id UUID,
    investor_name TEXT,
    farmer_id UUID,
    farmer_name TEXT,
    gross_amount NUMERIC,
    commission NUMERIC,
    net_to_farmer NUMERIC,
    commission_rate NUMERIC,
    created_at TIMESTAMPTZ
) LANGUAGE sql STABLE AS $$
    SELECT
        e.id, e.investment_id, e.project_id,
        p.title, p.crop,
        e.investor_id, iu.name,
        e.farmer_id, fu.name,
        e.gross_amount, e.commission, e.net_to_farmer, e.commission_rate,
        e.created_at
      FROM platform_earnings e
      JOIN projects p ON p.id = e.project_id
      JOIN users iu   ON iu.id = e.investor_id
      JOIN users fu   ON fu.id = e.farmer_id
     ORDER BY e.created_at DESC;
$$;

-- Admin: ingresos agrupados por proyecto
CREATE OR REPLACE FUNCTION fn_admin_earnings_by_project()
RETURNS TABLE(
    project_id UUID,
    project_title TEXT,
    project_crop TEXT,
    investments_count BIGINT,
    total_gross NUMERIC,
    total_commission NUMERIC
) LANGUAGE sql STABLE AS $$
    SELECT
        p.id, p.title, p.crop,
        COUNT(e.id),
        COALESCE(SUM(e.gross_amount), 0),
        COALESCE(SUM(e.commission), 0)
      FROM projects p
      LEFT JOIN platform_earnings e ON e.project_id = p.id
     GROUP BY p.id, p.title, p.crop
     HAVING COUNT(e.id) > 0
     ORDER BY SUM(e.commission) DESC NULLS LAST;
$$;
