# Fixed Training Slots and Paper Test Workflow

## Decisions

- Every newly created or updated class session must occupy exactly one Vietnam-time training slot:
  - `morning`: 08:00–12:00
  - `afternoon`: 13:30–17:30
  - `evening`: 18:30–21:30
- Existing sessions that do not match one of those slots are intentionally removed during migration so the calendar has one uniform model. Attendance rows attached to those sessions are removed by the existing cascade; optional assessment links are detached first so assessment history survives.
- Admin creates and configures required in-class tests and the final exam. Tests are conducted on paper. Assigned teachers only enter scores after marking the paper and provide a reason for later corrections. Students never take or submit tests online.

## Architecture

The REST contract keeps `starts_at` and `ends_at` for compatibility. The Admin form replaces free-form datetime inputs with a Vietnam calendar date and a slot selector, then converts the selected slot to RFC3339 timestamps. The Go scheduling service rejects any timestamps that do not exactly match a slot, and a PostgreSQL check constraint protects writes outside the application.

The shared weekly calendar becomes a seven-column by three-row slot grid. Month and mobile agenda views remain available. Role pages pass compact summary statistics for the loaded range:

- Admin: Sắp diễn ra, Đã diễn ra, Đã hủy.
- Teacher: Sắp dạy, Đã dạy, Chưa điểm danh.
- Student: Sắp học, Đã tham gia, Vắng mặt.

Student attendance colors and counts use existing personal attendance records. Teacher/Admin counts use session time, status, and attendance-lock state already returned by the schedule APIs.

## Data Integrity and Errors

- Slot comparisons use `Asia/Ho_Chi_Minh`, never the workstation timezone.
- Same-class, same-teacher, and same-location exclusion constraints remain the source of overlap conflict detection.
- Invalid slot input returns a stable `SESSION_TIME_SLOT_INVALID` conflict response.
- Locked attendance and session audit rules remain unchanged.
- The destructive migration is one-way with respect to removed demo/history sessions; its down migration drops only the new constraint because deleted rows cannot be reconstructed safely.

## UI and Accessibility

- Slot rows show the Vietnamese slot name and exact time range.
- Each event remains a semantic button with an accessible label and keyboard focus behavior.
- Summary items use both text and colored dots; color is never the sole status signal.
- The desktop weekly view fits within one screen without a vertical hourly timeline; small screens continue to use a readable agenda.
- Test screens explicitly explain that assessment is on paper and the website only records results.

## Verification

- Go unit tests cover all valid slots, timezone offsets, and invalid boundaries.
- Migration up/down/up and DB integration tests prove deletion and constraint enforcement.
- React tests cover slot inference, three-row rendering, role summaries, and click behavior.
- Run Go vet/tests, sqlc generation checks, frontend lint/typecheck/format/tests/build, OpenAPI lint, and relevant browser E2E when services are available.
