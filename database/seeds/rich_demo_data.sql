-- ==========================================================================
-- RICH DEMO DATA SEED SCRIPT FOR NSA TRAINING PLATFORM
-- Ready to run on Supabase SQL Editor or local PostgreSQL.
-- Contains full courses, modules, criteria, classes, teachers, students,
-- schedules, attendance, and notifications.
-- ==========================================================================

BEGIN;

-- ==========================================================================
-- 1. TRAINING LOCATIONS (Phòng học & Xưởng thực hành)
-- ==========================================================================
INSERT INTO training_locations (id, code, name, location_type, capacity, is_active) VALUES
  ('10000000-0000-0000-0000-000000000001', 'LT-101', 'Phòng Lý thuyết Công nghệ Ô tô 101', 'classroom', 35, TRUE),
  ('10000000-0000-0000-0000-000000000002', 'LT-102', 'Phòng Mô phỏng & Chẩn đoán Điện tử 102', 'classroom', 25, TRUE),
  ('10000000-0000-0000-0000-000000000003', 'XH-01', 'Xưởng Thực hành Điện & Điện tử Ô tô XH1', 'workshop', 20, TRUE),
  ('10000000-0000-0000-0000-000000000004', 'XH-02', 'Xưởng Thực hành Động cơ & Khung gầm XH2', 'workshop', 20, TRUE)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, location_type = EXCLUDED.location_type, capacity = EXCLUDED.capacity, is_active = TRUE;

-- ==========================================================================
-- 2. COURSES & MODULES (Khóa đào tạo & Mô-đun - Tỷ lệ điểm danh bắt buộc = 80%)
-- ==========================================================================
-- Khóa 1: Điện & Điện tử Ô tô Nâng cao
INSERT INTO courses (id, code, name, description, total_sessions, minimum_attendance_pct, status) VALUES
  ('20000000-0000-0000-0000-000000000001', 'AUTO-ELEC-PRO', 'Kỹ thuật Điện & Điện tử Ô tô Nâng cao', 
   'Đào tạo chuyên sâu về hệ thống mạng giao tiếp CAN/LIN bus, cảm biến, cơ cấu chấp hành và chẩn đoán điện thân xe thế hệ mới.', 12, 80.00, 'active')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, total_sessions = EXCLUDED.total_sessions, minimum_attendance_pct = 80.00, status = EXCLUDED.status;

INSERT INTO course_modules (id, course_id, code, name, sequence_no, planned_sessions, description) VALUES
  ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'ELEC-M01', 'Mạng giao tiếp trên xe (CAN/LIN Bus)', 1, 4, 'Nguyên lý truyền thông, đo xung tín hiệu oscilloscope, chẩn đoán lỗi mạng.'),
  ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'ELEC-M02', 'Hệ thống Điện Thân xe & BCM thông minh', 2, 4, 'Hệ thống Smart Key, gạt mưa tự động, đèn pha thích ứng và Body Control Module.'),
  ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'ELEC-M03', 'Chẩn đoán Nâng cao bằng Máy Scan Chuyên hãng', 3, 4, 'Phân tích Data stream, kích hoạt kiểm tra cơ cấu chấp hành, cài đặt chìa khóa.')
ON CONFLICT (course_id, code) DO UPDATE
SET name = EXCLUDED.name, sequence_no = EXCLUDED.sequence_no, planned_sessions = EXCLUDED.planned_sessions, description = EXCLUDED.description;

-- Tiêu chí đánh giá năng lực thực hành cho Khóa 1
INSERT INTO competency_criteria (id, course_id, module_id, code, name, description, is_required, sequence_no) VALUES
  ('22000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'CRIT-ELEC-01', 'Kỹ năng đo kiểm xung CAN-High/CAN-Low', 'Sử dụng Oscilloscope đo dạng sóng tín hiệu mạng CAN và xác định ngắn mạch/hở mạch', TRUE, 1),
  ('22000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000002', 'CRIT-ELEC-02', 'Chẩn đoán mã lỗi DTC và phân tích Data List', 'Đọc mã lỗi hệ thống BCM, phân tích các giá trị cảm biến trên máy chẩn đoán chuyên dụng', TRUE, 2),
  ('22000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000003', 'CRIT-ELEC-03', 'An toàn điện và quy trình 5S xưởng dịch vụ', 'Tuân thủ quy định bảo hộ lao động, ngắt cọc âm ắc quy đúng kỹ thuật và giữ vệ sinh xưởng', TRUE, 3)
ON CONFLICT (course_id, code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, is_required = EXCLUDED.is_required, sequence_no = EXCLUDED.sequence_no;

-- Khóa 2: Chẩn đoán Động cơ Xăng & Diesel Phun điện tử
INSERT INTO courses (id, code, name, description, total_sessions, minimum_attendance_pct, status) VALUES
  ('20000000-0000-0000-0000-000000000002', 'AUTO-ENG-EFI', 'Chẩn đoán Hệ thống Động cơ Phun xăng Trực tiếp GDI/CRDi', 
   'Nắm vững hệ thống nhiên liệu áp suất cao GDI và Common Rail Diesel, xử lý hiện tượng bỏ máy, khói đen, hao xăng.', 16, 80.00, 'active')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, total_sessions = EXCLUDED.total_sessions, minimum_attendance_pct = 80.00, status = EXCLUDED.status;

INSERT INTO course_modules (id, course_id, code, name, sequence_no, planned_sessions, description) VALUES
  ('21000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'ENG-M01', 'Hệ thống Phun xăng Trực tiếp GDI', 1, 6, 'Cấu tạo bơm cao áp, kim phun điện từ, cảm biến áp suất ray nhiên liệu.'),
  ('21000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 'ENG-M02', 'Hệ thống Phun dầu Điện tử Common Rail Diesel', 2, 6, 'Bơm cao áp CP4, kim phun Piezo, van điều khiển áp suất SCV/DRV.'),
  ('21000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 'ENG-M03', 'Hệ thống Xử lý Khí thải DPF & SCR (AdBlue)', 3, 4, 'Bầu lọc hạt DPF, hệ thống phun Urea SCR và cảm biến NOx.')
ON CONFLICT (course_id, code) DO UPDATE
SET name = EXCLUDED.name, sequence_no = EXCLUDED.sequence_no, planned_sessions = EXCLUDED.planned_sessions, description = EXCLUDED.description;

-- Khóa 3: Công nghệ Xe Hybrid & Xe Điện (EV)
INSERT INTO courses (id, code, name, description, total_sessions, minimum_attendance_pct, status) VALUES
  ('20000000-0000-0000-0000-000000000003', 'AUTO-EV-HYBRID', 'Kỹ thuật An toàn & Bảo dưỡng Xe Điện & Xe Hybrid (EV/HEV)', 
   'Quy trình an toàn điện cao áp (High Voltage Safety), cấu tạo pack pin Lithium-ion, bộ biến tần Inverter và động cơ điện đồng bộ nam châm vĩnh cửu.', 10, 80.00, 'active')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, total_sessions = EXCLUDED.total_sessions, minimum_attendance_pct = 80.00, status = EXCLUDED.status;

INSERT INTO course_modules (id, course_id, code, name, sequence_no, planned_sessions, description) VALUES
  ('21000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000003', 'EV-M01', 'An toàn Điện Cao áp & Cầu dao ngắt khẩn cấp', 1, 3, 'Trang bị bảo hộ cấp điện áp 1000V, kiểm tra cách điện Megohmmeter, cô lập hệ thống pin cao áp.'),
  ('21000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000003', 'EV-M02', 'Quản lý Pin Cao áp BMS & Làm mát Pin', 2, 4, 'Cân bằng cell pin, kiểm tra nhiệt độ pack pin, xử lý lỗi sạc DC sạc nhanh.'),
  ('21000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000003', 'EV-M03', 'Hệ thống Truyền lực Điện & Phanh tái sinh', 3, 3, 'Inverter điều khiển MG1/MG2, phanh tái sinh điện năng Regenerative Braking.')
ON CONFLICT (course_id, code) DO UPDATE
SET name = EXCLUDED.name, sequence_no = EXCLUDED.sequence_no, planned_sessions = EXCLUDED.planned_sessions, description = EXCLUDED.description;

-- ==========================================================================
-- 3. ADDITIONAL TEACHERS & STUDENTS (Thêm Giảng viên & Học viên mẫu)
-- ==========================================================================
-- Thêm Giảng viên 2: ThS. Nguyễn Văn Hùng
INSERT INTO users (id, email, password_hash, status, must_change_password) VALUES
  ('22222222-2222-2222-2222-222222222223', 'hung.nguyen@nsa.local', '$2a$10$GsxiaGCj4KByEhya9W2DKuBXIXe2rFCEPSqwArzcHJkRes85Q2AQe', 'active', FALSE),
  ('22222222-2222-2222-2222-222222222224', 'thang.tran@nsa.local', '$2a$10$GsxiaGCj4KByEhya9W2DKuBXIXe2rFCEPSqwArzcHJkRes85Q2AQe', 'active', FALSE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.code = 'TEACHER'
WHERE u.email IN ('hung.nguyen@nsa.local', 'thang.tran@nsa.local')
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO teacher_profiles (user_id, teacher_code, full_name, specialization, phone, status)
SELECT id, 'TCH-002', 'ThS. Nguyễn Văn Hùng', 'Chuyên gia Động cơ Phun dầu & SCR', '0912345678', 'active'
FROM users WHERE email = 'hung.nguyen@nsa.local'
ON CONFLICT (teacher_code) DO NOTHING;

INSERT INTO teacher_profiles (user_id, teacher_code, full_name, specialization, phone, status)
SELECT id, 'TCH-003', 'Kỹ sư Trần Đức Thắng', 'Chuyên gia Xe Điện EV & Mạng CAN', '0987654321', 'active'
FROM users WHERE email = 'thang.tran@nsa.local'
ON CONFLICT (teacher_code) DO NOTHING;

-- Thêm 4 Học viên mẫu
INSERT INTO users (id, email, password_hash, status, must_change_password) VALUES
  ('33333333-3333-3333-3333-333333333334', 'nam.nguyen@nsa.local', '$2a$10$GsxiaGCj4KByEhya9W2DKuBXIXe2rFCEPSqwArzcHJkRes85Q2AQe', 'active', FALSE),
  ('33333333-3333-3333-3333-333333333335', 'long.le@nsa.local',    '$2a$10$GsxiaGCj4KByEhya9W2DKuBXIXe2rFCEPSqwArzcHJkRes85Q2AQe', 'active', FALSE),
  ('33333333-3333-3333-3333-333333333336', 'tuan.pham@nsa.local',   '$2a$10$GsxiaGCj4KByEhya9W2DKuBXIXe2rFCEPSqwArzcHJkRes85Q2AQe', 'active', FALSE),
  ('33333333-3333-3333-3333-333333333337', 'huy.tran@nsa.local',    '$2a$10$GsxiaGCj4KByEhya9W2DKuBXIXe2rFCEPSqwArzcHJkRes85Q2AQe', 'active', FALSE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.code = 'STUDENT'
WHERE u.email IN ('nam.nguyen@nsa.local', 'long.le@nsa.local', 'tuan.pham@nsa.local', 'huy.tran@nsa.local')
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO student_profiles (user_id, full_name, phone, status, enrolled_at)
SELECT id, 'Nguyễn Thành Nam', '0934112233', 'active', CURRENT_DATE - 45
FROM users WHERE email = 'nam.nguyen@nsa.local'
AND NOT EXISTS (SELECT 1 FROM student_profiles WHERE user_id = users.id);

INSERT INTO student_profiles (user_id, full_name, phone, status, enrolled_at)
SELECT id, 'Lê Hoàng Long', '0934445566', 'active', CURRENT_DATE - 45
FROM users WHERE email = 'long.le@nsa.local'
AND NOT EXISTS (SELECT 1 FROM student_profiles WHERE user_id = users.id);

INSERT INTO student_profiles (user_id, full_name, phone, status, enrolled_at)
SELECT id, 'Phạm Minh Tuấn', '0934778899', 'active', CURRENT_DATE - 45
FROM users WHERE email = 'tuan.pham@nsa.local'
AND NOT EXISTS (SELECT 1 FROM student_profiles WHERE user_id = users.id);

INSERT INTO student_profiles (user_id, full_name, phone, status, enrolled_at)
SELECT id, 'Trần Quang Huy', '0934123789', 'active', CURRENT_DATE - 45
FROM users WHERE email = 'huy.tran@nsa.local'
AND NOT EXISTS (SELECT 1 FROM student_profiles WHERE user_id = users.id);

-- ==========================================================================
-- 4. CLASSES & ENROLLMENTS (Lớp học: planning, in_progress)
-- ==========================================================================
-- Lớp 1: Điện Ô tô K24-A (Đang học)
INSERT INTO classes (id, course_id, class_code, name, start_date, end_date, maximum_students, status) VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'K24-ELEC-A', 'Lớp Kỹ thuật Điện Ô tô K24 (Khóa Ban ngày)', CURRENT_DATE - 20, CURRENT_DATE + 40, 25, 'in_progress'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
   'K24-ENG-B', 'Lớp Động cơ Phun xăng Trực tiếp K24 (Khóa Tối)', CURRENT_DATE - 15, CURRENT_DATE + 50, 20, 'in_progress'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003',
   'K24-EV-PRO', 'Lớp Chuyên đề An toàn & Pin Xe Điện EV K24', CURRENT_DATE + 7, CURRENT_DATE + 45, 15, 'planning')
ON CONFLICT (class_code) DO UPDATE
SET name = EXCLUDED.name, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, maximum_students = EXCLUDED.maximum_students, status = EXCLUDED.status;

-- Phân công giảng viên
INSERT INTO teacher_assignments (class_id, teacher_id, assignment_role, assigned_by)
SELECT '30000000-0000-0000-0000-000000000001', tp.id, 'Giảng viên chính', (SELECT id FROM users WHERE email = 'admin@nsa.local')
FROM teacher_profiles tp JOIN users u ON u.id = tp.user_id WHERE u.email = 'teacher@nsa.local'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

INSERT INTO teacher_assignments (class_id, teacher_id, assignment_role, assigned_by)
SELECT '30000000-0000-0000-0000-000000000002', tp.id, 'Giảng viên chính', (SELECT id FROM users WHERE email = 'admin@nsa.local')
FROM teacher_profiles tp JOIN users u ON u.id = tp.user_id WHERE u.email = 'hung.nguyen@nsa.local'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- Ghi danh học viên vào lớp K24-ELEC-A
INSERT INTO class_enrollments (class_id, student_id, status, enrolled_at, created_by)
SELECT '30000000-0000-0000-0000-000000000001', sp.id, 'enrolled', CURRENT_DATE - 20, (SELECT id FROM users WHERE email = 'admin@nsa.local')
FROM student_profiles sp
JOIN users u ON u.id = sp.user_id
WHERE u.email IN ('student@nsa.local', 'nam.nguyen@nsa.local', 'long.le@nsa.local', 'tuan.pham@nsa.local', 'huy.tran@nsa.local')
ON CONFLICT (class_id, student_id) DO UPDATE SET status = 'enrolled';

-- ==========================================================================
-- 5. CLASS SESSIONS (Khớp chuẩn khung giờ cố định 08:00-12:00, 13:30-17:30)
-- ==========================================================================
-- Buổi 1: Thứ 2 tuần này (08:00 - 12:00) - Mạng CAN Bus (Xưởng XH-01)
INSERT INTO class_sessions (
  id, class_id, course_id, module_id, teacher_id, location_id, title,
  session_type, starts_at, ends_at, status, created_by
)
SELECT '40000000-0000-0000-0000-000000000001',
       '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
       '21000000-0000-0000-0000-000000000001', tp.id,
       '10000000-0000-0000-0000-000000000003', 'Thực hành Đo kiểm Mạng CAN Bus & Oscilloscope', 'workshop',
       (date_trunc('week', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '0 days 8 hours') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       (date_trunc('week', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '0 days 12 hours') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       'completed', (SELECT id FROM users WHERE email = 'admin@nsa.local')
FROM teacher_profiles tp JOIN users u ON u.id = tp.user_id WHERE u.email = 'teacher@nsa.local'
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, status = EXCLUDED.status;

-- Buổi 2: Thứ 4 tuần này (13:30 - 17:30) - Chẩn đoán BCM (Phòng LT-102)
INSERT INTO class_sessions (
  id, class_id, course_id, module_id, teacher_id, location_id, title,
  session_type, starts_at, ends_at, status, created_by
)
SELECT '40000000-0000-0000-0000-000000000002',
       '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
       '21000000-0000-0000-0000-000000000002', tp.id,
       '10000000-0000-0000-0000-000000000002', 'Lý thuyết & Mô phỏng Body Control Module (BCM)', 'theory',
       (date_trunc('week', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '2 days 13 hours 30 minutes') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       (date_trunc('week', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '2 days 17 hours 30 minutes') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       'scheduled', (SELECT id FROM users WHERE email = 'admin@nsa.local')
FROM teacher_profiles tp JOIN users u ON u.id = tp.user_id WHERE u.email = 'teacher@nsa.local'
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, status = EXCLUDED.status;

-- Buổi 3: Thứ 6 tuần này (08:00 - 12:00) - Kiểm tra Đánh giá Kỹ năng (Xưởng XH-01)
INSERT INTO class_sessions (
  id, class_id, course_id, module_id, teacher_id, location_id, title,
  session_type, starts_at, ends_at, status, created_by
)
SELECT '40000000-0000-0000-0000-000000000003',
       '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
       '21000000-0000-0000-0000-000000000003', tp.id,
       '10000000-0000-0000-0000-000000000003', 'Đánh giá Kỹ năng Thực hành: Khoanh vùng Lỗi Mạng Xe', 'assessment',
       (date_trunc('week', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '4 days 8 hours') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       (date_trunc('week', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '4 days 12 hours') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       'scheduled', (SELECT id FROM users WHERE email = 'admin@nsa.local')
FROM teacher_profiles tp JOIN users u ON u.id = tp.user_id WHERE u.email = 'teacher@nsa.local'
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, status = EXCLUDED.status;

-- ==========================================================================
-- 6. ATTENDANCE RECORDS (Bản ghi điểm danh)
-- ==========================================================================
INSERT INTO attendance_records (class_session_id, class_id, student_id, status, note, recorded_by)
SELECT '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
       sp.id, 'present', 'Tham gia đúng giờ, thực hành xuất sắc', (SELECT id FROM users WHERE email = 'teacher@nsa.local')
FROM student_profiles sp JOIN users u ON u.id = sp.user_id WHERE u.email = 'student@nsa.local'
ON CONFLICT (class_session_id, student_id) DO UPDATE SET status = 'present', note = EXCLUDED.note;

INSERT INTO attendance_records (class_session_id, class_id, student_id, status, note, recorded_by)
SELECT '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
       sp.id, 'present', 'Có mặt đúng giờ', (SELECT id FROM users WHERE email = 'teacher@nsa.local')
FROM student_profiles sp JOIN users u ON u.id = sp.user_id WHERE u.email = 'nam.nguyen@nsa.local'
ON CONFLICT (class_session_id, student_id) DO UPDATE SET status = 'present';

INSERT INTO attendance_records (class_session_id, class_id, student_id, status, note, recorded_by)
SELECT '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
       sp.id, 'excused', 'Có đơn xin phép bận việc đột xuất', (SELECT id FROM users WHERE email = 'teacher@nsa.local')
FROM student_profiles sp JOIN users u ON u.id = sp.user_id WHERE u.email = 'long.le@nsa.local'
ON CONFLICT (class_session_id, student_id) DO UPDATE SET status = 'excused', note = EXCLUDED.note;

-- ==========================================================================
-- 7. NOTIFICATIONS (Thông báo hệ thống)
-- ==========================================================================
INSERT INTO notifications (user_id, title, message, type) VALUES
  ((SELECT id FROM users WHERE email = 'admin@nsa.local'), 
   'Chào mừng Quản trị viên', 'Chào mừng bạn đến với Hệ thống Quản lý Đào tạo Kỹ thuật Ô tô NSA Platform.', 'info'),
  ((SELECT id FROM users WHERE email = 'admin@nsa.local'), 
   'Báo cáo tuần mới', 'Đã tạo lịch học tuần hiện tại cho 3 lớp học K24.', 'system'),
  ((SELECT id FROM users WHERE email = 'teacher@nsa.local'), 
   'Lịch giảng dạy mới', 'Bạn có lịch dạy thực hành lớp K24-ELEC-A tại Xưởng XH-01.', 'schedule'),
  ((SELECT id FROM users WHERE email = 'teacher@nsa.local'), 
   'Nhắc nhở điểm danh', 'Vui lòng hoàn tất điểm danh cho buổi học Mạng CAN Bus.', 'reminder'),
  ((SELECT id FROM users WHERE email = 'student@nsa.local'), 
   'Thời khóa biểu mới', 'Lịch học lớp Điện K24 tuần này đã được cập nhật. Xem chi tiết tại Lịch học.', 'schedule'),
  ((SELECT id FROM users WHERE email = 'student@nsa.local'), 
   'Điểm danh thành công', 'Giảng viên đã xác nhận điểm danh: Có mặt (100%) cho buổi học vừa qua.', 'info');

COMMIT;
