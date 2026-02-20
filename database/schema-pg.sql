-- ApiCore PostgreSQL Database Schema
-- Converted from SQLite schema for Render.com deployment
-- Created: February 2026

-- Users table for beekeepers
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    name        TEXT        NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT        NOT NULL,
    phone       TEXT,
    district    TEXT,
    role        TEXT        DEFAULT 'beekeeper',
    years_experience INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Apiaries table
CREATE TABLE IF NOT EXISTS apiaries (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name             TEXT        NOT NULL,
    district         TEXT        NOT NULL,
    area             TEXT,
    established_date DATE,
    status           TEXT        DEFAULT 'active',
    apiary_type      TEXT        DEFAULT 'personal',
    terrain          TEXT,
    forage_primary   TEXT,
    blooming_window  TEXT,
    gps_latitude     REAL,
    gps_longitude    REAL,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Hives table
CREATE TABLE IF NOT EXISTS hives (
    id                   SERIAL PRIMARY KEY,
    user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    apiary_id            INTEGER REFERENCES apiaries(id) ON DELETE SET NULL,
    name                 TEXT    NOT NULL,
    hive_type            TEXT    NOT NULL,
    location_type        TEXT    NOT NULL,
    status               TEXT    DEFAULT 'active',
    queen_present        BOOLEAN DEFAULT TRUE,
    queen_age            REAL,
    queen_age_risk       TEXT,
    colony_strength      TEXT,
    last_inspection_date DATE,
    inspection_overdue   BOOLEAN DEFAULT FALSE,
    pest_detected        BOOLEAN DEFAULT FALSE,
    pest_reported_date   DATE,
    is_starred           BOOLEAN DEFAULT FALSE,
    is_flagged           BOOLEAN DEFAULT FALSE,
    flag_reason          TEXT,
    gps_latitude         REAL,
    gps_longitude        REAL,
    notes                TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Inspections table
CREATE TABLE IF NOT EXISTS inspections (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hive_id         INTEGER NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    apiary_id       INTEGER REFERENCES apiaries(id) ON DELETE SET NULL,
    inspection_date DATE    NOT NULL,
    queen_present   BOOLEAN DEFAULT TRUE,
    colony_strength TEXT,
    pest_detected   BOOLEAN DEFAULT FALSE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Harvests table
CREATE TABLE IF NOT EXISTS harvests (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hive_id      INTEGER REFERENCES hives(id) ON DELETE SET NULL,
    apiary_id    INTEGER REFERENCES apiaries(id) ON DELETE SET NULL,
    harvest_date DATE    NOT NULL,
    harvest_type TEXT    NOT NULL,
    quantity     REAL    NOT NULL,
    unit         TEXT    DEFAULT 'kg',
    quality      TEXT,
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hive_id       INTEGER REFERENCES hives(id) ON DELETE SET NULL,
    apiary_id     INTEGER REFERENCES apiaries(id) ON DELETE SET NULL,
    expense_date  DATE    NOT NULL,
    expense_type  TEXT    NOT NULL,
    amount        REAL    NOT NULL,
    description   TEXT,
    receipt_image TEXT,
    notes         TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Income table
CREATE TABLE IF NOT EXISTS income (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    harvest_id  INTEGER REFERENCES harvests(id) ON DELETE SET NULL,
    income_date DATE    NOT NULL,
    income_type TEXT    NOT NULL,
    amount      REAL    NOT NULL,
    buyer_name  TEXT,
    description TEXT,
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hive_id    INTEGER REFERENCES hives(id) ON DELETE CASCADE,
    apiary_id  INTEGER REFERENCES apiaries(id) ON DELETE CASCADE,
    alert_type TEXT    NOT NULL,
    message    TEXT    NOT NULL,
    is_read    BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedings table
CREATE TABLE IF NOT EXISTS feedings (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hive_id      INTEGER NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    feeding_date DATE    NOT NULL,
    feed_type    TEXT    NOT NULL,
    quantity     REAL,
    unit         TEXT    DEFAULT 'ml',
    concentration TEXT,
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Hive Components table
CREATE TABLE IF NOT EXISTS hive_components (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hive_id        INTEGER NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    component_type TEXT    NOT NULL,
    quantity       INTEGER DEFAULT 1,
    condition      TEXT    DEFAULT 'good',
    installed_date DATE,
    notes          TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Queens table
CREATE TABLE IF NOT EXISTS queens (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hive_id           INTEGER NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    marking_color     TEXT,
    source            TEXT,
    introduction_date DATE,
    status            TEXT DEFAULT 'active',
    species           TEXT,
    notes             TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Treatments table
CREATE TABLE IF NOT EXISTS treatments (
    id                 SERIAL PRIMARY KEY,
    user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hive_id            INTEGER NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    treatment_date     DATE    NOT NULL,
    treatment_type     TEXT    NOT NULL,
    product_name       TEXT,
    dosage             TEXT,
    application_method TEXT,
    duration_days      INTEGER,
    end_date           DATE,
    outcome            TEXT,
    notes              TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Apiary History table
CREATE TABLE IF NOT EXISTS apiary_history (
    id         SERIAL PRIMARY KEY,
    apiary_id  INTEGER NOT NULL REFERENCES apiaries(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    action     TEXT    NOT NULL,
    details    TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helper Invitations table
CREATE TABLE IF NOT EXISTS helper_invitations (
    id          SERIAL PRIMARY KEY,
    invited_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email       TEXT    NOT NULL,
    token       TEXT    UNIQUE NOT NULL,
    status      TEXT    DEFAULT 'pending',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ
);

-- Hive Assignments table
CREATE TABLE IF NOT EXISTS hive_assignments (
    id          SERIAL PRIMARY KEY,
    hive_id     INTEGER NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    helper_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at  TIMESTAMPTZ,
    status      TEXT DEFAULT 'active',
    notes       TEXT
);

-- Client Services table
CREATE TABLE IF NOT EXISTS client_services (
    id                     SERIAL PRIMARY KEY,
    user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_name            TEXT    NOT NULL,
    client_contact         TEXT,
    client_email           TEXT,
    service_type           TEXT    NOT NULL,
    description            TEXT,
    location               TEXT,
    gps_latitude           REAL,
    gps_longitude          REAL,
    assigned_to            INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status                 TEXT    DEFAULT 'pending',
    priority               TEXT    DEFAULT 'normal',
    scheduled_date         DATE,
    completed_date         DATE,
    payment_amount         REAL,
    payment_status         TEXT    DEFAULT 'unpaid',
    expense_proof_required BOOLEAN DEFAULT FALSE,
    notes                  TEXT,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_service_hives (
    id         SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES client_services(id) ON DELETE CASCADE,
    hive_id    INTEGER NOT NULL REFERENCES hives(id)           ON DELETE CASCADE,
    UNIQUE (service_id, hive_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_role       TEXT    DEFAULT 'all',
    notification_type TEXT    NOT NULL,
    severity          TEXT    DEFAULT 'info',
    title             TEXT    NOT NULL,
    message           TEXT    NOT NULL,
    related_type      TEXT,
    related_id        INTEGER,
    is_read           BOOLEAN DEFAULT FALSE,
    is_dismissed      BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Colony Transfers table
CREATE TABLE IF NOT EXISTS colony_transfers (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    source_hive_id   INTEGER NOT NULL REFERENCES hives(id)   ON DELETE CASCADE,
    target_hive_id   INTEGER NOT NULL REFERENCES hives(id)   ON DELETE CASCADE,
    transfer_date    DATE    NOT NULL,
    transfer_type    TEXT    DEFAULT 'pot_to_box',
    queen_moved      BOOLEAN DEFAULT TRUE,
    brood_frames_moved INTEGER DEFAULT 0,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_apiaries_user         ON apiaries(user_id);
CREATE INDEX IF NOT EXISTS idx_hives_user            ON hives(user_id);
CREATE INDEX IF NOT EXISTS idx_hives_apiary          ON hives(apiary_id);
CREATE INDEX IF NOT EXISTS idx_inspections_user      ON inspections(user_id);
CREATE INDEX IF NOT EXISTS idx_inspections_hive      ON inspections(hive_id);
CREATE INDEX IF NOT EXISTS idx_harvests_user         ON harvests(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user         ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_income_user           ON income(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user           ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_feedings_hive         ON feedings(hive_id);
CREATE INDEX IF NOT EXISTS idx_hive_components_hive  ON hive_components(hive_id);
CREATE INDEX IF NOT EXISTS idx_queens_hive           ON queens(hive_id);
CREATE INDEX IF NOT EXISTS idx_treatments_hive       ON treatments(hive_id);
CREATE INDEX IF NOT EXISTS idx_apiary_history_apiary ON apiary_history(apiary_id);
CREATE INDEX IF NOT EXISTS idx_helper_inv_token      ON helper_invitations(token);
CREATE INDEX IF NOT EXISTS idx_hive_assign_helper    ON hive_assignments(helper_id);
CREATE INDEX IF NOT EXISTS idx_hive_assign_hive      ON hive_assignments(hive_id);
CREATE INDEX IF NOT EXISTS idx_client_services_user  ON client_services(user_id);
CREATE INDEX IF NOT EXISTS idx_client_services_asgnd ON client_services(assigned_to);
CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_col_transfers_source  ON colony_transfers(source_hive_id);
CREATE INDEX IF NOT EXISTS idx_col_transfers_target  ON colony_transfers(target_hive_id);
