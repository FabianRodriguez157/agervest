-- =====================================================================
-- AgerVest — Esquema inicial PostgreSQL
-- =====================================================================
-- Soporta: agricultores, inversionistas, aliados, proyectos agrícolas,
-- tokens, inversiones, actualizaciones de proyecto, migraciones.
-- Reemplaza el almacenamiento en memoria del prototipo v0.9.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- --------------------------------------------------------------------
-- Tabla de control de migraciones
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
    version      TEXT PRIMARY KEY,
    applied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- Tipos enumerados
-- --------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('farmer', 'investor', 'ally', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE project_risk AS ENUM ('bajo', 'medio', 'alto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('draft', 'active', 'funded', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE risk_profile AS ENUM ('conservador', 'moderado', 'agresivo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE farmer_payment_method AS ENUM ('bank_transfer', 'wallet', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE investor_payment_method AS ENUM ('bank_transfer', 'wallet', 'credit_card');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE project_payment_method AS ENUM ('percentage', 'fixed', 'monthly', 'harvest');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE insurance_status AS ENUM ('yes', 'planning', 'no');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE prior_experience AS ENUM ('yes', 'assisted', 'new');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE certification_type AS ENUM ('organic', 'conventional', 'in_transition', 'fair_trade', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE technical_support AS ENUM ('own_experience', 'contractor', 'government', 'agro_company', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE investment_experience AS ENUM ('none', 'basic', 'intermediate', 'advanced');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE investment_frequency AS ENUM ('monthly', 'quarterly', 'annual', 'sporadic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE id_document_type AS ENUM ('DNI', 'CE', 'PASSPORT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------------------------------------------------------------------
-- Usuarios base (autenticación unificada)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    role            user_role NOT NULL,
    name            TEXT NOT NULL,
    phone           TEXT,
    country         TEXT DEFAULT 'PE',
    verified        BOOLEAN NOT NULL DEFAULT FALSE,
    terms_accepted  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));

-- --------------------------------------------------------------------
-- Perfil agricultor
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS farmers (
    user_id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    location                TEXT NOT NULL,
    crop_type               TEXT NOT NULL,
    area_ha                 NUMERIC(10,2) NOT NULL CHECK (area_ha >= 0),
    document_id             TEXT NOT NULL,
    document_url            TEXT,
    years_experience        INTEGER NOT NULL DEFAULT 0 CHECK (years_experience >= 0),
    certifications          TEXT[] NOT NULL DEFAULT '{}',
    bank_account            TEXT NOT NULL,
    payment_method          farmer_payment_method NOT NULL DEFAULT 'bank_transfer',
    agricultural_certified  BOOLEAN NOT NULL DEFAULT FALSE,
    validated               BOOLEAN NOT NULL DEFAULT FALSE,
    trust_score             INTEGER NOT NULL DEFAULT 60 CHECK (trust_score BETWEEN 0 AND 100),
    avatar_seed             TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmers_validated ON farmers(validated);
CREATE INDEX IF NOT EXISTS idx_farmers_crop_type ON farmers(crop_type);

-- --------------------------------------------------------------------
-- Perfil inversionista
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS investors (
    user_id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    document_id             TEXT,
    document_id_type        id_document_type NOT NULL DEFAULT 'DNI',
    occupation              TEXT,
    investment_experience   investment_experience NOT NULL DEFAULT 'none',
    investment_frequency    investment_frequency NOT NULL DEFAULT 'sporadic',
    investment_budget       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (investment_budget >= 0),
    risk_profile            risk_profile NOT NULL DEFAULT 'moderado',
    bank_account            TEXT,
    payment_method          investor_payment_method NOT NULL DEFAULT 'bank_transfer',
    wallet_balance          NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (wallet_balance >= 0),
    risk_acknowledgment     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investors_risk_profile ON investors(risk_profile);

-- --------------------------------------------------------------------
-- Perfil aliado/asociación
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS allies (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    organization        TEXT NOT NULL,
    role_description    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- Proyectos agrícolas
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id           UUID NOT NULL REFERENCES farmers(user_id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    crop                TEXT NOT NULL,
    description         TEXT NOT NULL,
    location            TEXT NOT NULL,
    project_area_ha     NUMERIC(10,2) NOT NULL CHECK (project_area_ha > 0),
    crop_variety        TEXT NOT NULL,
    investment_needed   NUMERIC(14,2) NOT NULL CHECK (investment_needed > 0),
    amount_raised       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_raised >= 0),
    amount_available    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_available >= 0),
    duration_months     INTEGER NOT NULL CHECK (duration_months > 0),
    risk                project_risk NOT NULL,
    expected_return_pct NUMERIC(5,2) NOT NULL CHECK (expected_return_pct >= 0),
    payment_method      project_payment_method NOT NULL DEFAULT 'percentage',
    objectives          TEXT NOT NULL,
    benefits            TEXT NOT NULL,
    risk_mitigation     TEXT NOT NULL,
    has_insurance       insurance_status NOT NULL DEFAULT 'no',
    prior_experience    prior_experience NOT NULL DEFAULT 'assisted',
    certification       certification_type NOT NULL DEFAULT 'conventional',
    technical_support   technical_support NOT NULL DEFAULT 'own_experience',
    image_url           TEXT,
    document_url        TEXT,
    status              project_status NOT NULL DEFAULT 'active',
    progress            INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    featured            BOOLEAN NOT NULL DEFAULT FALSE,
    terms_accepted      BOOLEAN NOT NULL DEFAULT FALSE,
    updates_accepted    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_amount_available CHECK (amount_available <= investment_needed),
    CONSTRAINT chk_amount_raised    CHECK (amount_raised    <= investment_needed)
);

CREATE INDEX IF NOT EXISTS idx_projects_farmer    ON projects(farmer_id);
CREATE INDEX IF NOT EXISTS idx_projects_status    ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_crop      ON projects(LOWER(crop));
CREATE INDEX IF NOT EXISTS idx_projects_risk      ON projects(risk);
CREATE INDEX IF NOT EXISTS idx_projects_featured  ON projects(featured) WHERE featured = TRUE;

-- --------------------------------------------------------------------
-- Tokens emitidos por proyecto (1:1)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    symbol          TEXT NOT NULL,
    total_supply    NUMERIC(14,4) NOT NULL CHECK (total_supply > 0),
    price           NUMERIC(14,4) NOT NULL CHECK (price > 0),
    circulating     NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (circulating >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- Inversiones
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS investments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id         UUID NOT NULL REFERENCES investors(user_id) ON DELETE RESTRICT,
    project_id          UUID NOT NULL REFERENCES projects(id)       ON DELETE RESTRICT,
    amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    tokens_acquired     NUMERIC(14,4) NOT NULL CHECK (tokens_acquired > 0),
    expected_return     NUMERIC(14,2) NOT NULL CHECK (expected_return >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investments_investor ON investments(investor_id);
CREATE INDEX IF NOT EXISTS idx_investments_project  ON investments(project_id);

-- --------------------------------------------------------------------
-- Actualizaciones de proyecto (bitácora)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_updates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    message         TEXT NOT NULL,
    progress_delta  INTEGER NOT NULL DEFAULT 0,
    image_url       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_updates_project ON project_updates(project_id, created_at DESC);

-- --------------------------------------------------------------------
-- Sesiones (persistencia opcional — JWT es la ruta primaria)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_agent  TEXT,
    ip          TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- --------------------------------------------------------------------
-- Trigger: updated_at
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
