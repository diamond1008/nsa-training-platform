-- ==========================================================================
-- DEV-ONLY seed data — NSA Training Platform
-- NEVER run this in staging/production. All accounts are fake demo accounts.
--
-- Demo password for ALL accounts below:  NsaDemo@123   (bcrypt cost 10)
-- Change passwords immediately if this database is ever shared.
--
-- Apply with:  make db-seed
-- ==========================================================================

BEGIN;

-- ---------- Demo users (fixed UUIDs keep re-runs idempotent) ----------
INSERT INTO users (id, email, password_hash, status, must_change_password) VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@nsa.local',   '$2a$10$GsxiaGCj4KByEhya9W2DKuBXIXe2rFCEPSqwArzcHJkRes85Q2AQe', 'active', FALSE),
  ('22222222-2222-2222-2222-222222222222', 'teacher@nsa.local', '$2a$10$GsxiaGCj4KByEhya9W2DKuBXIXe2rFCEPSqwArzcHJkRes85Q2AQe', 'active', FALSE),
  ('33333333-3333-3333-3333-333333333333', 'student@nsa.local', '$2a$10$GsxiaGCj4KByEhya9W2DKuBXIXe2rFCEPSqwArzcHJkRes85Q2AQe', 'active', FALSE)
ON CONFLICT (email) DO NOTHING;

-- ---------- Role assignments (resolved by code, not hardcoded ids) ----------
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.code = 'ADMIN'
WHERE u.email = 'admin@nsa.local'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.code = 'TEACHER'
WHERE u.email = 'teacher@nsa.local'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.code = 'STUDENT'
WHERE u.email = 'student@nsa.local'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- ---------- Demo profiles ----------
INSERT INTO teacher_profiles (user_id, teacher_code, full_name, specialization, status)
SELECT id, 'TCH-DEMO-001', 'Demo Teacher', 'Automotive Electrical Systems', 'active'
FROM users WHERE email = 'teacher@nsa.local'
ON CONFLICT (teacher_code) DO NOTHING;

INSERT INTO student_profiles (user_id, full_name, status, enrolled_at)
SELECT id, 'Demo Student', 'active', CURRENT_DATE
FROM users u
WHERE u.email = 'student@nsa.local'
  AND NOT EXISTS (SELECT 1 FROM student_profiles sp WHERE sp.user_id = u.id);

INSERT INTO student_status_history (student_id, from_status, to_status, reason)
SELECT sp.id, NULL, sp.status, 'Khởi tạo dữ liệu demo'
FROM student_profiles sp
JOIN users u ON u.id = sp.user_id AND u.email = 'student@nsa.local'
WHERE NOT EXISTS (
  SELECT 1 FROM student_status_history ssh WHERE ssh.student_id = sp.id
);

COMMIT;
