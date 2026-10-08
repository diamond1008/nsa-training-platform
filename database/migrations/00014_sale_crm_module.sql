-- +goose Up

-- Enums
CREATE TYPE lead_source AS ENUM (
  'facebook',
  'tiktok',
  'google',
  'zalo',
  'website',
  'referral',
  'walk_in',
  'event',
  'other'
);

CREATE TYPE lead_pipeline_status AS ENUM (
  'data_moi',
  'knm_thue_bao',
  'goi_lai_sau',
  'follow',
  'tu_choi',
  'da_dang_ky',
  'dang_hoc',
  'ket_thuc'
);

CREATE TYPE interaction_channel AS ENUM (
  'phone_call',
  'zalo',
  'facebook',
  'email',
  'in_person',
  'sms',
  'other'
);

CREATE TYPE order_status AS ENUM (
  'pending',
  'paid',
  'cancelled',
  'refunded'
);

-- Leads table
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Thong tin ca nhan
  full_name VARCHAR(200) NOT NULL,
  phone VARCHAR(20),
  email CITEXT,
  date_of_birth DATE,
  gender VARCHAR(10),
  address TEXT,

  -- Nguon & chien dich
  source lead_source NOT NULL DEFAULT 'other',
  source_detail TEXT,
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(200),
  utm_content VARCHAR(200),
  utm_term VARCHAR(200),

  -- Quan tam
  interested_course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  notes TEXT,

  -- Pipeline
  pipeline_status lead_pipeline_status NOT NULL DEFAULT 'data_moi',

  -- Phan bo
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Chuyen doi
  converted_student_id UUID REFERENCES student_profiles(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  converted_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Audit
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_pipeline_status ON leads(pipeline_status);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_converted_student ON leads(converted_student_id) WHERE converted_student_id IS NOT NULL;
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_interested_course ON leads(interested_course_id) WHERE interested_course_id IS NOT NULL;

-- Lead interactions
CREATE TABLE lead_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel interaction_channel NOT NULL,
  summary TEXT NOT NULL,
  outcome TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_interactions_lead ON lead_interactions(lead_id, created_at DESC);

-- Lead tasks
CREATE TABLE lead_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_tasks_assignee_due ON lead_tasks(assigned_to, due_at) WHERE completed_at IS NULL;
CREATE INDEX idx_lead_tasks_lead ON lead_tasks(lead_id, created_at DESC);

-- Lead pipeline history
CREATE TABLE lead_pipeline_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  old_status lead_pipeline_status,
  new_status lead_pipeline_status NOT NULL,
  reason TEXT,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_pipeline_history_lead ON lead_pipeline_history(lead_id, changed_at DESC);

-- Orders sequence and table
CREATE SEQUENCE order_code_seq START WITH 1 INCREMENT BY 1 NO CYCLE;

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code VARCHAR(20) NOT NULL UNIQUE
    DEFAULT ('DH' || lpad(nextval('order_code_seq')::TEXT, 8, '0')),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  student_id UUID REFERENCES student_profiles(id) ON DELETE SET NULL,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  amount NUMERIC(12, 0) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12, 0) NOT NULL DEFAULT 0,
  final_amount NUMERIC(12, 0) NOT NULL DEFAULT 0,
  discount_note TEXT,
  status order_status NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(50),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_lead ON orders(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_orders_student ON orders(student_id) WHERE student_id IS NOT NULL;
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Role SALE
INSERT INTO roles (code, name, description)
VALUES ('SALE', 'Sale Staff', 'Manages leads, records interactions, converts leads to students, and creates orders.')
ON CONFLICT (code) DO NOTHING;

-- Triggers for updated_at
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_lead_tasks_updated_at BEFORE UPDATE ON lead_tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose Down
DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
DROP TRIGGER IF EXISTS trg_lead_tasks_updated_at ON lead_tasks;
DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
DROP TABLE IF EXISTS orders CASCADE;
DROP SEQUENCE IF EXISTS order_code_seq;
DROP TABLE IF EXISTS lead_pipeline_history CASCADE;
DROP TABLE IF EXISTS lead_tasks CASCADE;
DROP TABLE IF EXISTS lead_interactions CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TYPE IF EXISTS order_status;
DROP TYPE IF EXISTS interaction_channel;
DROP TYPE IF EXISTS lead_pipeline_status;
DROP TYPE IF EXISTS lead_source;
DELETE FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE code = 'SALE');
DELETE FROM roles WHERE code = 'SALE';
