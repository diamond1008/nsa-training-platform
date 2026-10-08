-- ==========================================================================
-- DEMO SALE CRM DATA — NSA Training Platform
-- Dữ liệu mẫu toàn diện cho module Tuyển sinh / CRM
-- ==========================================================================

DO $$
DECLARE
  -- Users
  v_admin UUID := '11111111-1111-1111-1111-111111111111';
  v_sale_admin UUID := '44444444-4444-4444-4444-444444444440';
  v_sale1 UUID := '44444444-4444-4444-4444-444444444444';
  v_sale2 UUID := '44444444-4444-4444-4444-444444444445';
  v_sale3 UUID := '44444444-4444-4444-4444-444444444446';

  -- Courses
  v_c1 UUID := '20000000-0000-0000-0000-000000000001'; -- Kỹ thuật Điện & Điện tử Ô tô Nâng cao
  v_c2 UUID := '20000000-0000-0000-0000-000000000002'; -- Chẩn đoán Động cơ Phun xăng GDI/CRDi
  v_c3 UUID := '20000000-0000-0000-0000-000000000003'; -- Kỹ thuật Xe Điện & Hybrid EV/HEV

  -- Classes
  v_cls1 UUID := '30000000-0000-0000-0000-000000000001'; -- K24-ELEC-A
  v_cls2 UUID := '30000000-0000-0000-0000-000000000002'; -- K24-ENG-B
  v_cls3 UUID := '30000000-0000-0000-0000-000000000003'; -- K24-EV-PRO

  -- Existing Student Profiles for converted leads
  v_stu1 UUID := 'fc4b6416-ee74-492e-a13f-1897064a779a'; -- Nguyễn Thành Nam
  v_stu2 UUID := '98a56a05-dbf9-477b-a3d4-7d200140f1db'; -- Lê Hoàng Long
BEGIN
  -- 1. Xóa các leads và orders demo cũ (giữ an toàn chỉ xóa các id 5555... và 6666...)
  DELETE FROM orders WHERE id >= '66666666-6666-6666-6666-666666666600' AND id <= '66666666-6666-6666-6666-666666666699';
  DELETE FROM leads WHERE id >= '55555555-5555-5555-5555-555555555500' AND id <= '55555555-5555-5555-5555-555555555599';

  -- 2. INSERT LEADS
  -- Lead 1: Nguyễn Văn Hùng (Sale 1 - data_moi)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, utm_source, utm_campaign, interested_course_id, pipeline_status, assigned_to, assigned_at, assigned_by, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555501', 'Nguyễn Văn Hùng', '0912345678', 'hung.nv@gmail.com', '1998-05-14', 'Nam', 'Quận Cầu Giấy, Hà Nội', 'facebook', 'Quảng cáo Facebook Ads', 'facebook', 'dien_oto_t10', v_c1, 'data_moi', v_sale1, NOW() - INTERVAL '2 hours', v_sale_admin, v_sale_admin, NOW() - INTERVAL '3 hours');

  -- Lead 2: Trần Thị Mai (Sale 1 - follow)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, utm_source, interested_course_id, pipeline_status, assigned_to, assigned_at, assigned_by, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555502', 'Trần Thị Mai', '0987654321', 'mai.tran@gmail.com', '1995-11-20', 'Nữ', 'Quận Đống Đa, Hà Nội', 'zalo', 'Khách quét QR Zalo tại triển lãm AutoTech', 'zalo_oa', v_c3, 'follow', v_sale1, NOW() - INTERVAL '2 days', v_sale_admin, v_sale1, NOW() - INTERVAL '3 days');

  -- Lead 3: Lê Hoàng Long (Sale 2 - goi_lai_sau)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, assigned_to, assigned_at, assigned_by, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555503', 'Lê Hoàng Long', '0903332211', 'long.lh@gmail.com', '2001-08-09', 'Nam', 'Thị xã Sơn Tây, Hà Nội', 'website', 'Form đăng ký tư vấn website', v_c2, 'goi_lai_sau', v_sale2, NOW() - INTERVAL '1 day', v_sale_admin, v_sale_admin, NOW() - INTERVAL '1 day');

  -- Lead 4: Phạm Quốc Dũng (Sale 1 - follow)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, assigned_to, assigned_at, assigned_by, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555504', 'Phạm Quốc Dũng', '0934567890', 'dung.pq@garaoto.vn', '1992-03-25', 'Nam', 'Quận Nam Từ Liêm, Hà Nội', 'referral', 'Gara Thành Phát giới thiệu thợ chính đi học', v_c1, 'follow', v_sale1, NOW() - INTERVAL '4 days', v_admin, v_sale1, NOW() - INTERVAL '5 days');

  -- Lead 5: Vũ Đình Trọng (Sale 2 - knm_thue_bao)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, assigned_to, assigned_at, assigned_by, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555505', 'Vũ Đình Trọng', '0971234567', 'trong.vd@gmail.com', '2000-12-01', 'Nam', 'Huyện Đông Anh, Hà Nội', 'tiktok', 'Kênh TikTok kỹ thuật xe NSA', v_c1, 'knm_thue_bao', v_sale2, NOW() - INTERVAL '1 day', v_sale_admin, v_sale2, NOW() - INTERVAL '2 days');

  -- Lead 6: Hoàng Minh Tuấn (Sale 1 - da_dang_ky)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, assigned_to, assigned_at, assigned_by, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555506', 'Hoàng Minh Tuấn', '0968889999', 'tuan.hm@gmail.com', '1997-07-18', 'Nam', 'Quận Thanh Xuân, Hà Nội', 'google', 'Tìm kiếm Google: khóa học ô tô điện EV', v_c3, 'da_dang_ky', v_sale1, NOW() - INTERVAL '5 days', v_sale_admin, v_sale1, NOW() - INTERVAL '6 days');

  -- Lead 7: Đỗ Gia Huy (Sale 1 - dang_hoc / đã chuyển đổi sang học viên)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, assigned_to, assigned_at, assigned_by, converted_student_id, converted_at, converted_by, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555507', 'Đỗ Gia Huy', '0945678123', 'huy.dg@gmail.com', '1999-04-12', 'Nam', 'Quận Ba Đình, Hà Nội', 'walk_in', 'Đến tham quan trực tiếp xưởng thực hành', v_c1, 'dang_hoc', v_sale1, NOW() - INTERVAL '15 days', v_sale_admin, v_stu1, NOW() - INTERVAL '10 days', v_sale1, v_sale1, NOW() - INTERVAL '20 days');

  -- Lead 8: Bùi Anh Quân (Sale 2 - tu_choi)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, assigned_to, assigned_at, assigned_by, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555508', 'Bùi Anh Quân', '0918765432', 'quan.ba@gmail.com', '1996-09-30', 'Nam', 'Quận Hoàng Mai, Hà Nội', 'facebook', 'Lead Form Facebook Ads', v_c2, 'tu_choi', v_sale2, NOW() - INTERVAL '6 days', v_sale_admin, v_sale2, NOW() - INTERVAL '7 days');

  -- Lead 9: Dương Văn Quyết (Chưa phân bổ - data_moi)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555509', 'Dương Văn Quyết', '0982223344', 'quyet.dv@gmail.com', '1998-02-14', 'Nam', 'Quận Hà Đông, Hà Nội', 'website', 'Landing Page Khóa Điện Ô Tô K24', v_c1, 'data_moi', v_admin, NOW() - INTERVAL '1 hour');

  -- Lead 10: Trịnh Khắc Cường (Chưa phân bổ - data_moi)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555510', 'Trịnh Khắc Cường', '0904445566', 'cuong.tk@gmail.com', '2002-06-22', 'Nam', 'Huyện Gia Lâm, Hà Nội', 'tiktok', 'TikTok Video review công nghệ chẩn đoán CAN', v_c3, 'data_moi', v_admin, NOW() - INTERVAL '30 minutes');

  -- Lead 11: Ngô Quang Hải (Chưa phân bổ - data_moi)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555511', 'Ngô Quang Hải', '0977889900', 'hai.nq@gmail.com', '1994-10-10', 'Nam', 'Quận Long Biên, Hà Nội', 'event', 'Workshop Công Nghệ Xe Điện NSA 2026', v_c3, 'data_moi', v_admin, NOW() - INTERVAL '4 hours');

  -- Lead 12: Phan Văn Đức (Sale 3 - follow)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, assigned_to, assigned_at, assigned_by, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555512', 'Phan Văn Đức', '0933112233', 'duc.pv@gmail.com', '1993-01-17', 'Nam', 'Quận Tây Hồ, Hà Nội', 'google', 'Google Search: khóa học phun xăng điện tử GDI', v_c2, 'follow', v_sale3, NOW() - INTERVAL '3 days', v_sale_admin, v_sale3, NOW() - INTERVAL '4 days');

  -- Lead 13: Lâm Thanh Sơn (Sale 2 - da_dang_ky)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, assigned_to, assigned_at, assigned_by, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555513', 'Lâm Thanh Sơn', '0915667788', 'son.lt@gara-son.vn', '1990-12-05', 'Nam', 'Quận Bắc Từ Liêm, Hà Nội', 'referral', 'Đối tác Gara Sơn Auto cử nhân viên đi học', v_c1, 'da_dang_ky', v_sale2, NOW() - INTERVAL '4 days', v_sale_admin, v_sale2, NOW() - INTERVAL '5 days');

  -- Lead 14: Đặng Tiến Dũng (Sale 2 - dang_hoc / đã chuyển đổi học viên)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, assigned_to, assigned_at, assigned_by, converted_student_id, converted_at, converted_by, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555514', 'Đặng Tiến Dũng', '0989112244', 'dung.dt@gmail.com', '1997-08-30', 'Nam', 'Quận Cầu Giấy, Hà Nội', 'zalo', 'Zalo Mini App đăng ký tư vấn', v_c2, 'dang_hoc', v_sale2, NOW() - INTERVAL '25 days', v_sale_admin, v_stu2, NOW() - INTERVAL '20 days', v_sale2, v_sale2, NOW() - INTERVAL '30 days');

  -- Lead 15: Võ Văn Kiệt (Sale 3 - data_moi)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, assigned_to, assigned_at, assigned_by, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555515', 'Võ Văn Kiệt', '0906778899', 'kiet.vv@gmail.com', '2001-03-15', 'Nam', 'Quận Nam Từ Liêm, Hà Nội', 'facebook', 'Fanpage NSA post xe Hybrid', v_c3, 'data_moi', v_sale3, NOW() - INTERVAL '5 hours', v_sale_admin, v_sale3, NOW() - INTERVAL '6 hours');

  -- Lead 16: Tạ Đình Phong (Sale 3 - follow)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, assigned_to, assigned_at, assigned_by, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555516', 'Tạ Đình Phong', '0943221100', 'phong.td@gmail.com', '1995-07-22', 'Nam', 'Quận Thanh Xuân, Hà Nội', 'website', 'Website Form tư vấn nghề', v_c1, 'follow', v_sale3, NOW() - INTERVAL '2 days', v_sale_admin, v_sale3, NOW() - INTERVAL '3 days');

  -- Lead 17: Nguyễn Hải Đăng (Chưa phân bổ - data_moi)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555517', 'Nguyễn Hải Đăng', '0976554433', 'dang.nh@gmail.com', '1999-11-11', 'Nam', 'Quận Hai Bà Trưng, Hà Nội', 'walk_in', 'Ghé văn phòng trung tâm nhận brochure', v_c2, 'data_moi', v_admin, NOW() - INTERVAL '5 hours');

  -- Lead 18: Trần Bảo Nam (Sale 1 - goi_lai_sau)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, assigned_to, assigned_at, assigned_by, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555518', 'Trần Bảo Nam', '0913998877', 'nam.tb@gmail.com', '2003-09-02', 'Nam', 'Quận Đống Đa, Hà Nội', 'facebook', 'Quảng cáo Facebook', v_c1, 'goi_lai_sau', v_sale1, NOW() - INTERVAL '1 day', v_sale_admin, v_sale1, NOW() - INTERVAL '2 days');

  -- Lead 19: Hồ Công Lý (Sale 3 - da_dang_ky)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, assigned_to, assigned_at, assigned_by, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555519', 'Hồ Công Lý', '0908112255', 'ly.hc@gmail.com', '1992-05-19', 'Nam', 'Quận Cầu Giấy, Hà Nội', 'tiktok', 'Livestream tư vấn xe điện', v_c3, 'da_dang_ky', v_sale3, NOW() - INTERVAL '2 days', v_sale_admin, v_sale3, NOW() - INTERVAL '3 days');

  -- Lead 20: Chu Minh Trí (Sale 2 - ket_thuc)
  INSERT INTO leads (id, full_name, phone, email, date_of_birth, gender, address, source, source_detail, interested_course_id, pipeline_status, assigned_to, assigned_at, assigned_by, created_by, created_at)
  VALUES ('55555555-5555-5555-5555-555555555520', 'Chu Minh Trí', '0984443322', 'tri.cm@gmail.com', '1994-04-04', 'Nam', 'Quận Ba Đình, Hà Nội', 'other', 'Đối tác đào tạo cơ quan', v_c1, 'ket_thuc', v_sale2, NOW() - INTERVAL '60 days', v_sale_admin, v_sale2, NOW() - INTERVAL '65 days');

  -- 3. INSERT LEAD INTERACTIONS
  INSERT INTO lead_interactions (lead_id, channel, summary, outcome, created_by, created_at) VALUES
  ('55555555-5555-5555-5555-555555555502', 'phone_call', 'Trao đổi qua điện thoại về lộ trình 10 buổi khóa An toàn & Xe Điện EV', 'Khách đề nghị gửi đề cương chi tiết môn học qua Zalo để xem trước', v_sale1, NOW() - INTERVAL '2 days'),
  ('55555555-5555-5555-5555-555555555502', 'zalo', 'Đã kết bạn Zalo và gửi file PDF giáo trình chi tiết + bảng học phí ưu đãi', 'Khách đã xem, phản hồi tích cực và hẹn đăng ký lớp tối thứ 3-5-7', v_sale1, NOW() - INTERVAL '1 day'),

  ('55555555-5555-5555-5555-555555555503', 'phone_call', 'Gọi điện tư vấn lần đầu cho khách', 'Khách đang bận họp bàn giao ca xưởng, hẹn gọi lại sau 17h30', v_sale2, NOW() - INTERVAL '1 day'),

  ('55555555-5555-5555-5555-555555555504', 'in_person', 'Khách ghé trung tâm tham quan phòng lab ô tô và các mô hình chẩn đoán động cơ', 'Rất ấn tượng với trang thiết bị, hẹn rủ thêm 1 đồng nghiệp cùng đăng ký', v_sale1, NOW() - INTERVAL '3 days'),
  ('55555555-5555-5555-5555-555555555504', 'phone_call', 'Gọi hỏi thăm tình hình đồng nghiệp và chốt lịch học', 'Đang chờ đồng nghiệp sắp xếp ca trực để chốt cả 2 suất', v_sale1, NOW() - INTERVAL '1 day'),

  ('55555555-5555-5555-5555-555555555505', 'phone_call', 'Gọi 2 cuộc liên tiếp lúc 9h sáng và 14h chiều', 'Thuê bao không liên lạc được, đã gửi SMS giới thiệu', v_sale2, NOW() - INTERVAL '1 day'),

  ('55555555-5555-5555-5555-555555555506', 'phone_call', 'Tư vấn chuyên sâu về khóa K24-EV-PRO và hướng dẫn thủ tục nhập học', 'Khách đồng ý đăng ký, xin số tài khoản trung tâm để chuyển khoản đặt cọc', v_sale1, NOW() - INTERVAL '2 days'),
  ('55555555-5555-5555-5555-555555555506', 'zalo', 'Gửi thông tin tài khoản ngân hàng và hợp đồng đào tạo qua Zalo', 'Khách xác nhận đã nhận được hợp đồng', v_sale1, NOW() - INTERVAL '1 day'),

  ('55555555-5555-5555-5555-555555555507', 'in_person', 'Khách đến trung tâm làm thủ tục nhập học và đóng học phí trực tiếp', 'Hoàn tất thủ tục, xếp lớp K24-ELEC-A', v_sale1, NOW() - INTERVAL '10 days'),

  ('55555555-5555-5555-5555-555555555508', 'phone_call', 'Liên hệ tư vấn khóa động cơ GDI/CRDi', 'Khách báo vừa nhận quyết định điều chuyển công tác vào TP.HCM nên không học được', v_sale2, NOW() - INTERVAL '5 days'),

  ('55555555-5555-5555-5555-555555555512', 'phone_call', 'Tư vấn lớp K24-ENG-B buổi tối', 'Khách muốn tìm hiểu kỹ phần đo kiểm kim phun Common Rail', v_sale3, NOW() - INTERVAL '2 days'),

  ('55555555-5555-5555-5555-555555555513', 'facebook', 'Tư vấn qua fanpage cho đại diện Gara Sơn', 'Gara đồng ý thanh toán cho nhân viên, chờ gửi hóa đơn VAT', v_sale2, NOW() - INTERVAL '3 days'),

  ('55555555-5555-5555-5555-555555555516', 'in_person', 'Tiếp đón khách tham quan cơ sở vật chất phòng học điện ô tô', 'Khách hài lòng, hẹn nộp hồ sơ trước ngày khai giảng', v_sale3, NOW() - INTERVAL '2 days'),

  ('55555555-5555-5555-5555-555555555518', 'phone_call', 'Gọi tư vấn khóa điện nâng cao', 'Khách đang thi học kỳ trường ĐH Giao thông Vận tải, hẹn thi xong sẽ đăng ký', v_sale1, NOW() - INTERVAL '1 day'),

  ('55555555-5555-5555-5555-555555555519', 'zalo', 'Tư vấn gói học xe điện EV nâng cao và chính sách hỗ trợ việc làm', 'Khách chuyển khoản thanh toán học phí thành công', v_sale3, NOW() - INTERVAL '1 day');

  -- 4. INSERT LEAD TASKS
  INSERT INTO lead_tasks (lead_id, assigned_to, title, description, due_at, completed_at, created_by, created_at) VALUES
  -- Quá hạn (Overdue) để test cảnh báo quá hạn trên giao diện
  ('55555555-5555-5555-5555-555555555515', v_sale3, 'Gọi điện tư vấn khách Võ Văn Kiệt', 'Khách để lại thông tin từ livestream TikTok, cần gọi sớm trước khi nguội lead', NOW() - INTERVAL '2 hours', NULL, v_sale3, NOW() - INTERVAL '5 hours'),
  ('55555555-5555-5555-5555-555555555505', v_sale2, 'Gọi lại cho khách Vũ Đình Trọng', 'Hôm qua không nhấc máy, cần thử lại vào đầu giờ sáng', NOW() - INTERVAL '4 hours', NULL, v_sale2, NOW() - INTERVAL '1 day'),

  -- Sắp tới / Hôm nay (Upcoming / Due today)
  ('55555555-5555-5555-5555-555555555501', v_sale1, 'Gọi điện tư vấn lộ trình và xếp lớp cho anh Hùng', 'Khách có nhu cầu học ngay trong tháng 10 này', NOW() + INTERVAL '3 hours', NULL, v_sale1, NOW() - INTERVAL '2 hours'),
  ('55555555-5555-5555-5555-555555555503', v_sale2, 'Gọi lại sau giờ tan ca cho anh Long', 'Khách hẹn sau 17h30 chiều nay gọi lại', NOW() + INTERVAL '5 hours', NULL, v_sale2, NOW() - INTERVAL '1 day'),
  ('55555555-5555-5555-5555-555555555502', v_sale1, 'Nhắn tin Zalo nhắc chị Mai về ưu đãi đóng sớm', 'Hạn chót ưu đãi giảm 1.5 triệu là cuối tuần này', NOW() + INTERVAL '1 day', NULL, v_sale1, NOW() - INTERVAL '1 day'),
  ('55555555-5555-5555-5555-555555555504', v_sale1, 'Chuẩn bị phòng tiếp đón anh Dũng và bạn sang xưởng', 'Hẹn sang cơ sở xem phòng thực hành lúc 14h thứ 7', NOW() + INTERVAL '2 days', NULL, v_sale1, NOW() - INTERVAL '3 days'),
  ('55555555-5555-5555-5555-555555555512', v_sale3, 'Gửi thời khóa biểu lớp K24-ENG-B cho anh Đức', 'Kèm danh sách các thiết bị máy đọc lỗi thực hành', NOW() + INTERVAL '1 day', NULL, v_sale3, NOW() - INTERVAL '2 days'),
  ('55555555-5555-5555-5555-555555555516', v_sale3, 'Nhắc anh Phong nộp ảnh thẻ và CCCD hoàn thiện hồ sơ', 'Hạn chót hoàn tất hồ sơ trước ngày khai giảng 3 ngày', NOW() + INTERVAL '3 days', NULL, v_sale3, NOW() - INTERVAL '1 day'),
  ('55555555-5555-5555-5555-555555555518', v_sale1, 'Hẹn gọi lại sau kỳ thi đại học cho Nam', 'Theo dõi và liên hệ lại sau khi kết thúc môn thi', NOW() + INTERVAL '5 days', NULL, v_sale1, NOW() - INTERVAL '1 day'),

  -- Đã hoàn thành (Completed)
  ('55555555-5555-5555-5555-555555555506', v_sale1, 'Gửi số tài khoản ngân hàng trung tâm', 'Đã gửi qua Zalo và SMS cho anh Tuấn', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', v_sale1, NOW() - INTERVAL '2 days'),
  ('55555555-5555-5555-5555-555555555507', v_sale1, 'Lập phiếu thu và tạo hồ sơ nhập học', 'Đã cấp mã học viên và bàn giao cho khối đào tạo', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', v_sale1, NOW() - INTERVAL '12 days'),
  ('55555555-5555-5555-5555-555555555519', v_sale3, 'Xác nhận chuyển khoản và gửi thư mời nhập học', 'Đã kiểm tra biến động số dư và gửi email xác nhận', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', v_sale3, NOW() - INTERVAL '2 days');

  -- 5. INSERT LEAD PIPELINE HISTORY
  INSERT INTO lead_pipeline_history (lead_id, old_status, new_status, reason, changed_by, changed_at) VALUES
  ('55555555-5555-5555-5555-555555555502', 'data_moi', 'follow', 'Đã liên hệ cuộc gọi đầu tiên và khách quan tâm khóa học', v_sale1, NOW() - INTERVAL '2 days'),
  ('55555555-5555-5555-5555-555555555503', 'data_moi', 'goi_lai_sau', 'Khách đang bận họp, hẹn liên hệ lại cuối giờ chiều', v_sale2, NOW() - INTERVAL '1 day'),
  ('55555555-5555-5555-5555-555555555504', 'data_moi', 'follow', 'Khách tới xem trực tiếp cơ sở thực hành', v_sale1, NOW() - INTERVAL '3 days'),
  ('55555555-5555-5555-5555-555555555505', 'data_moi', 'knm_thue_bao', 'Gọi 2 lần đều không liên lạc được', v_sale2, NOW() - INTERVAL '1 day'),
  ('55555555-5555-5555-5555-555555555506', 'data_moi', 'follow', 'Tư vấn chương trình đào tạo ô tô điện', v_sale1, NOW() - INTERVAL '4 days'),
  ('55555555-5555-5555-5555-555555555506', 'follow', 'da_dang_ky', 'Khách chốt đăng ký, tạo đơn hàng thanh toán', v_sale1, NOW() - INTERVAL '2 days'),
  ('55555555-5555-5555-5555-555555555507', 'data_moi', 'follow', 'Tư vấn tại văn phòng', v_sale1, NOW() - INTERVAL '18 days'),
  ('55555555-5555-5555-5555-555555555507', 'follow', 'da_dang_ky', 'Hoàn tất đóng học phí tại quầy', v_sale1, NOW() - INTERVAL '12 days'),
  ('55555555-5555-5555-5555-555555555507', 'da_dang_ky', 'dang_hoc', 'Khai giảng lớp K24-ELEC-A', v_sale1, NOW() - INTERVAL '10 days'),
  ('55555555-5555-5555-5555-555555555508', 'data_moi', 'follow', 'Tư vấn ban đầu', v_sale2, NOW() - INTERVAL '6 days'),
  ('55555555-5555-5555-5555-555555555508', 'follow', 'tu_choi', 'Khách chuyển công tác vào miền Nam', v_sale2, NOW() - INTERVAL '5 days'),
  ('55555555-5555-5555-5555-555555555513', 'data_moi', 'follow', 'Gửi báo giá doanh nghiệp', v_sale2, NOW() - INTERVAL '4 days'),
  ('55555555-5555-5555-5555-555555555513', 'follow', 'da_dang_ky', 'Gara duyệt chi ngân sách cử thợ đi học', v_sale2, NOW() - INTERVAL '2 days'),
  ('55555555-5555-5555-5555-555555555514', 'data_moi', 'follow', 'Tư vấn Zalo', v_sale2, NOW() - INTERVAL '28 days'),
  ('55555555-5555-5555-5555-555555555514', 'follow', 'da_dang_ky', 'Chuyển khoản học phí', v_sale2, NOW() - INTERVAL '23 days'),
  ('55555555-5555-5555-5555-555555555514', 'da_dang_ky', 'dang_hoc', 'Chuyển đổi sang học viên chính thức', v_sale2, NOW() - INTERVAL '20 days'),
  ('55555555-5555-5555-5555-555555555519', 'data_moi', 'follow', 'Tư vấn qua Zalo', v_sale3, NOW() - INTERVAL '3 days'),
  ('55555555-5555-5555-5555-555555555519', 'follow', 'da_dang_ky', 'Khách chuyển khoản đủ học phí khóa EV', v_sale3, NOW() - INTERVAL '1 day');

  -- 6. INSERT ORDERS (Đơn hàng & Doanh thu)
  -- Order 1: Đã thanh toán (paid) - Khóa Điện Nâng Cao (Đỗ Gia Huy)
  INSERT INTO orders (id, order_code, lead_id, student_id, course_id, class_id, amount, discount_amount, final_amount, discount_note, status, payment_method, paid_at, notes, created_by, created_at)
  VALUES ('66666666-6666-6666-6666-666666666601', 'DH00000001', '55555555-5555-5555-5555-555555555507', v_stu1, v_c1, v_cls1, 15000000, 1500000, 13500000, 'Ưu đãi đăng ký sớm giảm 10%', 'paid', 'transfer', NOW() - INTERVAL '10 days', 'Đã thanh toán đủ qua chuyển khoản Vietcombank', v_sale1, NOW() - INTERVAL '12 days');

  -- Order 2: Đã thanh toán (paid) - Khóa Động cơ GDI (Đặng Tiến Dũng)
  INSERT INTO orders (id, order_code, lead_id, student_id, course_id, class_id, amount, discount_amount, final_amount, discount_note, status, payment_method, paid_at, notes, created_by, created_at)
  VALUES ('66666666-6666-6666-6666-666666666602', 'DH00000002', '55555555-5555-5555-5555-555555555514', v_stu2, v_c2, v_cls2, 16000000, 1000000, 15000000, 'Voucher Zalo Mini App', 'paid', 'transfer', NOW() - INTERVAL '22 days', 'Đã thanh toán qua Techcombank', v_sale2, NOW() - INTERVAL '25 days');

  -- Order 3: Đã thanh toán (paid) - Khóa Xe Điện EV (Hồ Công Lý)
  INSERT INTO orders (id, order_code, lead_id, student_id, course_id, class_id, amount, discount_amount, final_amount, discount_note, status, payment_method, paid_at, notes, created_by, created_at)
  VALUES ('66666666-6666-6666-6666-666666666603', 'DH00000003', '55555555-5555-5555-5555-555555555519', NULL, v_c3, v_cls3, 18000000, 2000000, 16000000, 'Ưu đãi sinh viên kỹ thuật', 'paid', 'transfer', NOW() - INTERVAL '1 day', 'Chuyển khoản MB Bank', v_sale3, NOW() - INTERVAL '2 days');

  -- Order 4: Đã thanh toán (paid) - Khóa Điện Nâng Cao (Chu Minh Trí)
  INSERT INTO orders (id, order_code, lead_id, student_id, course_id, class_id, amount, discount_amount, final_amount, discount_note, status, payment_method, paid_at, notes, created_by, created_at)
  VALUES ('66666666-6666-6666-6666-666666666604', 'DH00000004', '55555555-5555-5555-5555-555555555520', NULL, v_c1, v_cls1, 15000000, 0, 15000000, NULL, 'paid', 'cash', NOW() - INTERVAL '40 days', 'Thanh toán tiền mặt tại quầy', v_sale2, NOW() - INTERVAL '45 days');

  -- Order 5: Chờ duyệt (pending) - Khóa Xe Điện EV (Hoàng Minh Tuấn) -> Để Sale Admin / Admin vào duyệt thanh toán
  INSERT INTO orders (id, order_code, lead_id, student_id, course_id, class_id, amount, discount_amount, final_amount, discount_note, status, payment_method, paid_at, notes, created_by, created_at)
  VALUES ('66666666-6666-6666-6666-666666666605', 'DH00000005', '55555555-5555-5555-5555-555555555506', NULL, v_c3, v_cls3, 18000000, 1000000, 17000000, 'Ưu đãi đăng ký trước ngày 15', 'pending', 'transfer', NULL, 'Khách đã gửi ủy nhiệm chi, chờ kế toán kiểm tra biến động số dư', v_sale1, NOW() - INTERVAL '1 day');

  -- Order 6: Chờ duyệt (pending) - Khóa Điện Nâng Cao (Lâm Thanh Sơn) -> Để Sale Admin / Admin vào duyệt thanh toán
  INSERT INTO orders (id, order_code, lead_id, student_id, course_id, class_id, amount, discount_amount, final_amount, discount_note, status, payment_method, paid_at, notes, created_by, created_at)
  VALUES ('66666666-6666-6666-6666-666666666606', 'DH00000006', '55555555-5555-5555-5555-555555555513', NULL, v_c1, v_cls1, 15000000, 2000000, 13000000, 'Chiết khấu đối tác doanh nghiệp Gara', 'pending', 'transfer', NULL, 'Gara Sơn Auto đăng ký cho kỹ thuật viên', v_sale2, NOW() - INTERVAL '2 days');

  -- Order 7: Chờ duyệt (pending) - Khóa Xe Điện EV (Trần Thị Mai) -> Để Sale Admin / Admin vào duyệt thanh toán
  INSERT INTO orders (id, order_code, lead_id, student_id, course_id, class_id, amount, discount_amount, final_amount, discount_note, status, payment_method, paid_at, notes, created_by, created_at)
  VALUES ('66666666-6666-6666-6666-666666666607', 'DH00000007', '55555555-5555-5555-5555-555555555502', NULL, v_c3, v_cls3, 18000000, 1500000, 16500000, 'Khách hàng nữ đam mê kỹ thuật', 'pending', 'cash', NULL, 'Hẹn nộp tiền mặt vào buổi học đầu tiên', v_sale1, NOW() - INTERVAL '3 hours');

  -- Order 8: Đã hủy (cancelled) - Khóa Động cơ GDI (Bùi Anh Quân)
  INSERT INTO orders (id, order_code, lead_id, student_id, course_id, class_id, amount, discount_amount, final_amount, discount_note, status, payment_method, paid_at, notes, created_by, created_at)
  VALUES ('66666666-6666-6666-6666-666666666608', 'DH00000008', '55555555-5555-5555-5555-555555555508', NULL, v_c2, v_cls2, 16000000, 0, 16000000, NULL, 'cancelled', 'transfer', NULL, 'Hủy đơn do học viên đi công tác miền Nam dài hạn', v_sale2, NOW() - INTERVAL '5 days');

  -- Sync sequence order_code_seq so subsequent orders get DH00000009, DH00000010...
  PERFORM setval('order_code_seq', COALESCE((
    SELECT MAX(substring(order_code FROM '^DH([0-9]+)$')::BIGINT)
    FROM orders
    WHERE order_code ~ '^DH[0-9]+$'
  ), 0), true);

END $$;
