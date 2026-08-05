-- Deterministic fake data for Playwright/CI only.
-- Locally, run `make db-seed` followed by `make db-seed-e2e`; do not pipe this
-- UTF-8 file through Windows PowerShell 5 because its native-pipe encoding is ASCII.
BEGIN;

INSERT INTO courses (id, code, name, description, total_sessions, minimum_attendance_pct, status)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'E2E-COURSE', 'Khóa học kiểm thử E2E',
        'Dữ liệu giả chỉ dùng trong CI.', 8, 80, 'active')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    total_sessions = EXCLUDED.total_sessions,
    minimum_attendance_pct = EXCLUDED.minimum_attendance_pct,
    status = EXCLUDED.status;

INSERT INTO course_modules (id, course_id, code, name, sequence_no, planned_sessions)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'E2E-M01', 'Mô-đun E2E', 1, 8)
ON CONFLICT (course_id, code) DO UPDATE
SET name = EXCLUDED.name,
    sequence_no = EXCLUDED.sequence_no,
    planned_sessions = EXCLUDED.planned_sessions;

INSERT INTO classes (id, course_id, class_code, name, start_date, end_date, maximum_students, status)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'E2E-CLASS', 'Lớp kiểm thử E2E', CURRENT_DATE - 30, CURRENT_DATE + 30, 20, 'in_progress')
ON CONFLICT (class_code) DO UPDATE
SET name = EXCLUDED.name,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    maximum_students = EXCLUDED.maximum_students,
    status = EXCLUDED.status;

INSERT INTO teacher_assignments (id, class_id, teacher_id, assignment_role, assigned_by)
SELECT 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
       tp.id, 'Instructor', au.id
FROM teacher_profiles tp
JOIN users tu ON tu.id = tp.user_id AND tu.email = 'teacher@nsa.local'
JOIN users au ON au.email = 'admin@nsa.local'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

INSERT INTO class_enrollments (id, class_id, student_id, status, enrolled_at, created_by)
SELECT 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
       sp.id, 'enrolled', CURRENT_DATE - 30, au.id
FROM student_profiles sp
JOIN users su ON su.id = sp.user_id AND su.email = 'student@nsa.local'
JOIN users au ON au.email = 'admin@nsa.local'
ON CONFLICT (class_id, student_id) DO UPDATE
SET status = 'enrolled', enrolled_at = EXCLUDED.enrolled_at, ended_at = NULL;

INSERT INTO training_locations (id, code, name, location_type, capacity, is_active)
VALUES ('99999999-9999-9999-9999-999999999999', 'E2E-ROOM', 'Phòng kiểm thử E2E', 'classroom', 20, TRUE)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    location_type = EXCLUDED.location_type,
    capacity = EXCLUDED.capacity,
    is_active = EXCLUDED.is_active;

INSERT INTO class_sessions (
  id, class_id, course_id, module_id, teacher_id, location_id, title,
  session_type, starts_at, ends_at, status, created_by
)
SELECT '88888888-8888-8888-8888-888888888888',
       'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       'cccccccc-cccc-cccc-cccc-cccccccccccc', tp.id,
       '99999999-9999-9999-9999-999999999999', 'Lý thuyết E2E', 'theory',
       (date_trunc('week', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '2 days 13 hours 30 minutes') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       (date_trunc('week', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '2 days 17 hours 30 minutes') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       'scheduled', au.id
FROM teacher_profiles tp
JOIN users tu ON tu.id = tp.user_id AND tu.email = 'teacher@nsa.local'
JOIN users au ON au.email = 'admin@nsa.local'
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    starts_at = EXCLUDED.starts_at,
    ends_at = EXCLUDED.ends_at,
    status = EXCLUDED.status,
    teacher_id = EXCLUDED.teacher_id,
    location_id = EXCLUDED.location_id;

INSERT INTO attendance_records (
  id, class_session_id, class_id, student_id, status, note, recorded_by
)
SELECT '77777777-7777-7777-7777-777777777777',
       '88888888-8888-8888-8888-888888888888', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
       sp.id, 'present', 'Kết quả giả cho E2E', tu.id
FROM student_profiles sp
JOIN users su ON su.id = sp.user_id AND su.email = 'student@nsa.local'
JOIN users tu ON tu.email = 'teacher@nsa.local'
ON CONFLICT (class_session_id, student_id) DO UPDATE
SET status = EXCLUDED.status,
    note = EXCLUDED.note,
    recorded_by = EXCLUDED.recorded_by;

COMMIT;
