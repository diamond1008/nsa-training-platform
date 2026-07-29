-- In-app notifications scoped to the authenticated user.

-- name: CreateNotification :one
INSERT INTO notifications (user_id, title, message, type, action_url)
VALUES ($1,$2,$3,$4,$5) RETURNING *;

-- name: ListUserNotifications :many
SELECT * FROM notifications
WHERE user_id=$1 AND status <> 'archived'
ORDER BY created_at DESC, id DESC
LIMIT $3 OFFSET $2;

-- name: CountUserNotifications :one
SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND status <> 'archived';

-- name: CountUnreadNotifications :one
SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND status='unread';

-- name: MarkNotificationRead :one
UPDATE notifications SET status='read', read_at=COALESCE(read_at,NOW())
WHERE id=$1 AND user_id=$2 AND status <> 'archived' RETURNING *;

-- name: ArchiveNotification :one
UPDATE notifications SET status='archived'
WHERE id=$1 AND user_id=$2 RETURNING *;

-- name: ListClassNotificationRecipients :many
SELECT DISTINCT recipient.user_id
FROM (
  SELECT tp.user_id
  FROM teacher_assignments ta
  JOIN teacher_profiles tp ON tp.id=ta.teacher_id
  WHERE ta.class_id=$1
  UNION
  SELECT sp.user_id
  FROM class_enrollments ce
  JOIN student_profiles sp ON sp.id=ce.student_id
  WHERE ce.class_id=$1 AND ce.status IN ('enrolled','completed')
) recipient;

-- name: ListAdminNotificationRecipients :many
SELECT DISTINCT u.id
FROM users u
JOIN user_roles ur ON ur.user_id=u.id
JOIN roles r ON r.id=ur.role_id
WHERE r.code='ADMIN' AND u.status='active';

-- name: CreateAttendanceRiskNotifications :execrows
WITH risk AS (
  SELECT sp.user_id, c.class_code,
    ROUND(100.0*COUNT(*) FILTER (WHERE ar.status IN ('present','late'))/NULLIF(COUNT(*),0),2) AS attendance_pct
  FROM attendance_records ar
  JOIN classes c ON c.id=ar.class_id
  JOIN courses co ON co.id=c.course_id
  JOIN student_profiles sp ON sp.id=ar.student_id
  WHERE ar.status <> 'excused' AND c.status IN ('open','in_progress')
  GROUP BY sp.user_id,c.id,c.class_code,co.minimum_attendance_pct
  HAVING 100.0*COUNT(*) FILTER (WHERE ar.status IN ('present','late'))/NULLIF(COUNT(*),0) < co.minimum_attendance_pct
)
INSERT INTO notifications (user_id,title,message,type,action_url)
SELECT r.user_id, 'Cảnh báo chuyên cần',
  'Tỷ lệ chuyên cần lớp '||r.class_code||' hiện là '||r.attendance_pct||'%.',
  'attendance_risk', '/student/diem-danh'
FROM risk r
WHERE NOT EXISTS (
  SELECT 1 FROM notifications n
  WHERE n.user_id=r.user_id AND n.type='attendance_risk'
    AND n.created_at >= CURRENT_DATE AND n.status <> 'archived'
);
