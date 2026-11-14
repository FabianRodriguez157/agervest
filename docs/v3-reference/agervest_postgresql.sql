CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('inversionista','productor','aliado')),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS producer_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ppa_verified BOOLEAN DEFAULT FALSE,
  parcel_verified BOOLEAN DEFAULT FALSE,
  years_experience INTEGER DEFAULT 0,
  producer_score NUMERIC(5,2),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  producer_user_id INTEGER NOT NULL REFERENCES users(id),
  crop VARCHAR(100) NOT NULL,
  region VARCHAR(100) NOT NULL DEFAULT 'Arequipa',
  province VARCHAR(100),
  goal_amount NUMERIC(14,2) NOT NULL,
  min_contribution NUMERIC(14,2) NOT NULL DEFAULT 100,
  stage VARCHAR(40) NOT NULL DEFAULT 'Preparación',
  project_risk_score NUMERIC(5,2),
  confidence_index NUMERIC(5,2),
  status VARCHAR(30) NOT NULL DEFAULT 'en_revision',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
