-- ApiCore SQLite Database Schema
-- Created: February 4, 2026

-- Users table for beekeepers
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT,
    district TEXT,
    role TEXT DEFAULT 'beekeeper',
    years_experience INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Apiaries table
CREATE TABLE IF NOT EXISTS apiaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    district TEXT NOT NULL,
    area TEXT,
    established_date DATE,
    status TEXT DEFAULT 'active', -- active, empty, expired
    apiary_type TEXT DEFAULT 'personal', -- personal, client
    terrain TEXT,
    forage_primary TEXT,
    blooming_window TEXT,
    gps_latitude REAL,
    gps_longitude REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Hives table
CREATE TABLE IF NOT EXISTS hives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    apiary_id INTEGER,
    name TEXT NOT NULL,
    hive_type TEXT NOT NULL, -- box, pot, log, stingless
    location_type TEXT NOT NULL, -- apiary-linked, standalone
    status TEXT DEFAULT 'active', -- active, queenless, inactive, absconded
    queen_present BOOLEAN DEFAULT 1,
    queen_age REAL,
    queen_age_risk TEXT, -- low, medium, high
    colony_strength TEXT, -- weak, normal, strong
    last_inspection_date DATE,
    inspection_overdue BOOLEAN DEFAULT 0,
    pest_detected BOOLEAN DEFAULT 0,
    pest_reported_date DATE,
    is_starred BOOLEAN DEFAULT 0,
    is_flagged BOOLEAN DEFAULT 0,
    flag_reason TEXT,
    gps_latitude REAL,
    gps_longitude REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (apiary_id) REFERENCES apiaries(id) ON DELETE SET NULL
);

-- Inspections table
CREATE TABLE IF NOT EXISTS inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    hive_id INTEGER NOT NULL,
    apiary_id INTEGER,
    inspection_date DATE NOT NULL,
    queen_present BOOLEAN DEFAULT 1,
    colony_strength TEXT,
    pest_detected BOOLEAN DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (hive_id) REFERENCES hives(id) ON DELETE CASCADE,
    FOREIGN KEY (apiary_id) REFERENCES apiaries(id) ON DELETE SET NULL
);

-- Harvests table
CREATE TABLE IF NOT EXISTS harvests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    hive_id INTEGER,
    apiary_id INTEGER,
    harvest_date DATE NOT NULL,
    harvest_type TEXT NOT NULL, -- honey, beeswax, propolis, royal_jelly, pollen, other
    quantity REAL NOT NULL,
    unit TEXT DEFAULT 'kg',
    quality TEXT, -- premium, standard, organic
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (hive_id) REFERENCES hives(id) ON DELETE SET NULL,
    FOREIGN KEY (apiary_id) REFERENCES apiaries(id) ON DELETE SET NULL
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    hive_id INTEGER,
    apiary_id INTEGER,
    expense_date DATE NOT NULL,
    expense_type TEXT NOT NULL, -- equipment, maintenance, feed, medication, rental, transport, other
    amount REAL NOT NULL,
    description TEXT,
    receipt_image TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (hive_id) REFERENCES hives(id) ON DELETE SET NULL,
    FOREIGN KEY (apiary_id) REFERENCES apiaries(id) ON DELETE SET NULL
);

-- Income table
CREATE TABLE IF NOT EXISTS income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    harvest_id INTEGER,
    income_date DATE NOT NULL,
    income_type TEXT NOT NULL, -- honey_sale, wax_sale, pollination_service, other
    amount REAL NOT NULL,
    buyer_name TEXT,
    description TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (harvest_id) REFERENCES harvests(id) ON DELETE SET NULL
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    hive_id INTEGER,
    apiary_id INTEGER,
    alert_type TEXT NOT NULL, -- info, warning, critical
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (hive_id) REFERENCES hives(id) ON DELETE CASCADE,
    FOREIGN KEY (apiary_id) REFERENCES apiaries(id) ON DELETE CASCADE
);

-- Feedings table (R9.6)
CREATE TABLE IF NOT EXISTS feedings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    hive_id INTEGER NOT NULL,
    feeding_date DATE NOT NULL,
    feed_type TEXT NOT NULL, -- sugar_syrup, pollen_patty, fondant, honey, other
    quantity REAL,
    unit TEXT DEFAULT 'ml', -- ml, g, kg, l
    concentration TEXT, -- light, medium, heavy (for syrup)
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (hive_id) REFERENCES hives(id) ON DELETE CASCADE
);

-- Hive Components table (R14)
CREATE TABLE IF NOT EXISTS hive_components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    hive_id INTEGER NOT NULL,
    component_type TEXT NOT NULL, -- frame, super, feeder, queen_excluder, entrance_reducer, bottom_board, inner_cover, outer_cover, other
    quantity INTEGER DEFAULT 1,
    condition TEXT DEFAULT 'good', -- new, good, fair, poor, replaced
    installed_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (hive_id) REFERENCES hives(id) ON DELETE CASCADE
);

-- Queens table (R11)
CREATE TABLE IF NOT EXISTS queens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    hive_id INTEGER NOT NULL,
    marking_color TEXT, -- white, yellow, red, green, blue, unmarked
    source TEXT, -- purchased, swarm, reared, split, unknown
    introduction_date DATE,
    status TEXT DEFAULT 'active', -- active, superseded, dead, missing, removed
    species TEXT, -- apis_cerana, apis_mellifera, apis_dorsata, other
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (hive_id) REFERENCES hives(id) ON DELETE CASCADE
);

-- Treatments table (UC12.6)
CREATE TABLE IF NOT EXISTS treatments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    hive_id INTEGER NOT NULL,
    treatment_date DATE NOT NULL,
    treatment_type TEXT NOT NULL, -- varroa, nosema, foulbrood, wax_moth, small_hive_beetle, other
    product_name TEXT,
    dosage TEXT,
    application_method TEXT, -- strips, drench, dusting, spray, fumigation, other
    duration_days INTEGER,
    end_date DATE,
    outcome TEXT, -- effective, partially_effective, ineffective, ongoing
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (hive_id) REFERENCES hives(id) ON DELETE CASCADE
);

-- Apiary History table (R4.6)
CREATE TABLE IF NOT EXISTS apiary_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    apiary_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL, -- created, updated, status_change, hive_added, hive_removed
    details TEXT, -- JSON or plain text describing what changed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (apiary_id) REFERENCES apiaries(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Helper Invitations table (R1.2/R1.3/R1.4)
CREATE TABLE IF NOT EXISTS helper_invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invited_by INTEGER NOT NULL,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, accepted, expired
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    accepted_at DATETIME,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Hive Assignments table (R8)
CREATE TABLE IF NOT EXISTS hive_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hive_id INTEGER NOT NULL,
    helper_id INTEGER NOT NULL,
    assigned_by INTEGER NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME,
    status TEXT DEFAULT 'active', -- active, revoked
    notes TEXT,
    FOREIGN KEY (hive_id) REFERENCES hives(id) ON DELETE CASCADE,
    FOREIGN KEY (helper_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_apiaries_user ON apiaries(user_id);
CREATE INDEX IF NOT EXISTS idx_hives_user ON hives(user_id);
CREATE INDEX IF NOT EXISTS idx_hives_apiary ON hives(apiary_id);
CREATE INDEX IF NOT EXISTS idx_inspections_user ON inspections(user_id);
CREATE INDEX IF NOT EXISTS idx_inspections_hive ON inspections(hive_id);
CREATE INDEX IF NOT EXISTS idx_harvests_user ON harvests(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_income_user ON income(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_feedings_hive ON feedings(hive_id);
CREATE INDEX IF NOT EXISTS idx_hive_components_hive ON hive_components(hive_id);
CREATE INDEX IF NOT EXISTS idx_queens_hive ON queens(hive_id);
CREATE INDEX IF NOT EXISTS idx_treatments_hive ON treatments(hive_id);
CREATE INDEX IF NOT EXISTS idx_apiary_history_apiary ON apiary_history(apiary_id);
CREATE INDEX IF NOT EXISTS idx_helper_invitations_token ON helper_invitations(token);
CREATE INDEX IF NOT EXISTS idx_hive_assignments_helper ON hive_assignments(helper_id);
CREATE INDEX IF NOT EXISTS idx_hive_assignments_hive ON hive_assignments(hive_id);

-- ─── Client Services (R15) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    client_name TEXT NOT NULL,
    client_contact TEXT,
    client_email TEXT,
    service_type TEXT NOT NULL, -- pollination, hive_rental, honey_supply, pest_removal, consultation, other
    description TEXT,
    location TEXT,
    gps_latitude REAL,
    gps_longitude REAL,
    assigned_to INTEGER,
    status TEXT DEFAULT 'pending', -- pending, assigned, in_progress, completed, cancelled
    priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
    scheduled_date DATE,
    completed_date DATE,
    payment_amount REAL,
    payment_status TEXT DEFAULT 'unpaid', -- unpaid, partial, paid
    expense_proof_required BOOLEAN DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS client_service_hives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    hive_id INTEGER NOT NULL,
    FOREIGN KEY (service_id) REFERENCES client_services(id) ON DELETE CASCADE,
    FOREIGN KEY (hive_id) REFERENCES hives(id) ON DELETE CASCADE,
    UNIQUE(service_id, hive_id)
);

-- ─── Notifications & Reminders (R16) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    target_role TEXT DEFAULT 'all', -- admin, helper, all
    notification_type TEXT NOT NULL, -- inspection_due, feeding_due, queen_age, pest_alert, contract_expiry, task_assigned, task_status, system
    severity TEXT DEFAULT 'info', -- info, warning, critical
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_type TEXT, -- hive, apiary, client_service, queen
    related_id INTEGER,
    is_read BOOLEAN DEFAULT 0,
    is_dismissed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── Colony Transfers (R7.2) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS colony_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    source_hive_id INTEGER NOT NULL,
    target_hive_id INTEGER NOT NULL,
    transfer_date DATE NOT NULL,
    transfer_type TEXT DEFAULT 'pot_to_box', -- pot_to_box, split, merge
    queen_moved BOOLEAN DEFAULT 1,
    brood_frames_moved INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (source_hive_id) REFERENCES hives(id) ON DELETE CASCADE,
    FOREIGN KEY (target_hive_id) REFERENCES hives(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_client_services_user ON client_services(user_id);
CREATE INDEX IF NOT EXISTS idx_client_services_assigned ON client_services(assigned_to);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_colony_transfers_source ON colony_transfers(source_hive_id);
CREATE INDEX IF NOT EXISTS idx_colony_transfers_target ON colony_transfers(target_hive_id);

-- Schema complete. No default user - use Postman collection to create admin user.
