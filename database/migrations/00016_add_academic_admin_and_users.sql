-- +goose Up
-- Add role ACADEMIC_ADMIN
INSERT INTO roles (code, name, description)
VALUES ('ACADEMIC_ADMIN', 'Academic Administrator', 'Quản lý đào tạo: học viên, giảng viên, khóa học, lớp học, lịch học, điểm danh, thi và tốt nghiệp.')
ON CONFLICT (code) DO NOTHING;

-- Add full_name and phone columns to users table for unified user identity
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- Backfill full_name and phone from existing student_profiles and teacher_profiles
UPDATE users u
SET full_name = sp.full_name, phone = COALESCE(u.phone, sp.phone)
FROM student_profiles sp
WHERE sp.user_id = u.id AND u.full_name IS NULL;

UPDATE users u
SET full_name = tp.full_name, phone = COALESCE(u.phone, tp.phone)
FROM teacher_profiles tp
WHERE tp.user_id = u.id AND u.full_name IS NULL;

-- +goose Down
ALTER TABLE users DROP COLUMN IF EXISTS phone;
ALTER TABLE users DROP COLUMN IF EXISTS full_name;
DELETE FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE code = 'ACADEMIC_ADMIN');
DELETE FROM roles WHERE code = 'ACADEMIC_ADMIN';
