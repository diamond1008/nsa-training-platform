package students

import (
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/auth"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/request"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/response"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

const maxStudentCSVBytes = 2 << 20

type Handler struct {
	service *Service
	log     *slog.Logger
}

func NewHandler(service *Service, log *slog.Logger) *Handler {
	return &Handler{service: service, log: log}
}

type writeRequest struct {
	Email                 string  `json:"email"`
	Password              string  `json:"temporary_password,omitempty"`
	AccountStatus         string  `json:"account_status"`
	FullName              string  `json:"full_name"`
	Phone                 *string `json:"phone"`
	DateOfBirth           *string `json:"date_of_birth"`
	Gender                *string `json:"gender"`
	Address               *string `json:"address"`
	EmergencyContactName  *string `json:"emergency_contact_name"`
	EmergencyContactPhone *string `json:"emergency_contact_phone"`
	Status                string  `json:"status"`
	EnrolledAt            *string `json:"enrolled_at"`
	StatusChangeReason    *string `json:"status_change_reason"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var body writeRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	input, message := validateWrite(body, true)
	if message != "" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", message)
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.Create(r.Context(), actorID, input)
	h.writeResult(w, r, view, err, true)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	view, err := h.service.Get(r.Context(), chi.URLParam(r, "studentID"))
	h.writeResult(w, r, view, err, false)
}

func (h *Handler) StatusHistory(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.StatusHistory(r.Context(), chi.URLParam(r, "studentID"))
	if errors.Is(err, ErrNotFound) {
		response.Fail(w, http.StatusNotFound, "STUDENT_NOT_FOUND", "Student not found")
		return
	}
	if err != nil {
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
		return
	}
	response.OK(w, items)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	page, perPage, err := request.Page(r)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status != "" && !validStudentStatus(status) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid student status")
		return
	}
	result, err := h.service.List(r.Context(), r.URL.Query().Get("search"), status, page, perPage)
	if err != nil {
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
		return
	}
	response.OK(w, result)
}

func (h *Handler) ExportCSV(w http.ResponseWriter, r *http.Request) {
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status != "" && !validStudentStatus(status) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid student status")
		return
	}
	items, err := h.service.Export(r.Context(), r.URL.Query().Get("search"), status)
	if err != nil {
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="students.csv"`)
	_, _ = io.WriteString(w, "\xEF\xBB\xBF")
	writer := csv.NewWriter(w)
	_ = writer.Write([]string{
		"student_code", "email", "temporary_password", "full_name", "phone", "date_of_birth", "gender", "address",
		"emergency_contact_name", "emergency_contact_phone", "status", "enrolled_at", "account_status",
	})
	for _, item := range items {
		_ = writer.Write([]string{
			csvSafe(item.StudentCode), csvSafe(item.Email), "", csvSafe(item.FullName), csvSafe(pointerValue(item.Phone)),
			pointerValue(item.DateOfBirth), pointerValue(item.Gender), csvSafe(pointerValue(item.Address)),
			csvSafe(pointerValue(item.EmergencyContactName)), csvSafe(pointerValue(item.EmergencyContactPhone)),
			item.Status, pointerValue(item.EnrolledAt), item.AccountStatus,
		})
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		h.log.Error("write student CSV", "request_id", auth.RequestIDFrom(r.Context()), "error", err)
	}
}

type importRowError struct {
	Row     int    `json:"row"`
	Email   string `json:"email,omitempty"`
	Message string `json:"message"`
}

type importResult struct {
	Imported int              `json:"imported"`
	Failed   int              `json:"failed"`
	Errors   []importRowError `json:"errors"`
}

func (h *Handler) ImportCSV(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxStudentCSVBytes)
	reader := csv.NewReader(r.Body)
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1
	header, err := reader.Read()
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_CSV", "CSV header is required")
		return
	}
	columns := make(map[string]int, len(header))
	for index, name := range header {
		columns[strings.TrimSpace(strings.TrimPrefix(name, "\ufeff"))] = index
	}
	for _, required := range []string{"email", "temporary_password", "full_name"} {
		if _, ok := columns[required]; !ok {
			response.Fail(w, http.StatusBadRequest, "INVALID_CSV", fmt.Sprintf("CSV column %s is required", required))
			return
		}
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	result := importResult{Errors: make([]importRowError, 0)}
	for rowNumber := 2; ; rowNumber++ {
		if rowNumber > 501 {
			result.Failed++
			result.Errors = append(result.Errors, importRowError{Row: rowNumber, Message: "Mỗi lần chỉ được nhập tối đa 500 học viên"})
			break
		}
		record, readErr := reader.Read()
		if errors.Is(readErr, io.EOF) {
			break
		}
		if readErr != nil {
			result.Failed++
			result.Errors = append(result.Errors, importRowError{Row: rowNumber, Message: "Dòng CSV không hợp lệ"})
			continue
		}
		value := func(name string) string {
			index, ok := columns[name]
			if !ok || index >= len(record) {
				return ""
			}
			return strings.TrimSpace(record[index])
		}
		accountStatus, studentStatus := value("account_status"), value("status")
		if accountStatus == "" {
			accountStatus = "active"
		}
		if studentStatus == "" {
			studentStatus = "pending"
		}
		body := writeRequest{
			Email: value("email"), Password: value("temporary_password"), AccountStatus: accountStatus,
			FullName: value("full_name"), Phone: optionalCSV(value("phone")),
			DateOfBirth: optionalCSV(value("date_of_birth")), Gender: optionalCSV(value("gender")),
			Address: optionalCSV(value("address")), EmergencyContactName: optionalCSV(value("emergency_contact_name")),
			EmergencyContactPhone: optionalCSV(value("emergency_contact_phone")), Status: studentStatus,
			EnrolledAt: optionalCSV(value("enrolled_at")),
		}
		input, message := validateWrite(body, true)
		if message == "" {
			_, err = h.service.Create(r.Context(), actorID, input)
			message = importFailureMessage(err)
		}
		if message != "" {
			result.Failed++
			result.Errors = append(result.Errors, importRowError{Row: rowNumber, Email: body.Email, Message: message})
			continue
		}
		result.Imported++
	}
	response.OK(w, result)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	var body writeRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	input, message := validateWrite(body, false)
	if message != "" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", message)
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.Update(r.Context(), actorID, chi.URLParam(r, "studentID"), input)
	h.writeResult(w, r, view, err, false)
}

func (h *Handler) writeResult(w http.ResponseWriter, r *http.Request, view View, err error, created bool) {
	switch {
	case err == nil && created:
		response.Created(w, view)
	case err == nil:
		response.OK(w, view)
	case errors.Is(err, ErrNotFound):
		response.Fail(w, http.StatusNotFound, "STUDENT_NOT_FOUND", "Student not found")
	case errors.Is(err, ErrEmailConflict):
		response.Fail(w, http.StatusConflict, "EMAIL_ALREADY_EXISTS", "Email already exists")
	case errors.Is(err, ErrCodeConflict):
		response.Fail(w, http.StatusConflict, "STUDENT_CODE_ALREADY_EXISTS", "Student code already exists")
	case errors.Is(err, ErrStatusReason):
		response.Fail(w, http.StatusBadRequest, "STATUS_CHANGE_REASON_REQUIRED", "status_change_reason is required when status changes")
	default:
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
	}
}

func validateWrite(body writeRequest, create bool) (WriteInput, string) {
	body.Email = strings.ToLower(strings.TrimSpace(body.Email))
	body.FullName = strings.TrimSpace(body.FullName)
	body.AccountStatus = strings.TrimSpace(body.AccountStatus)
	body.Status = strings.TrimSpace(body.Status)
	body.Phone = normalizedOptional(body.Phone)
	body.DateOfBirth = normalizedOptional(body.DateOfBirth)
	body.Gender = normalizedOptional(body.Gender)
	body.Address = normalizedOptional(body.Address)
	body.EmergencyContactName = normalizedOptional(body.EmergencyContactName)
	body.EmergencyContactPhone = normalizedOptional(body.EmergencyContactPhone)
	body.EnrolledAt = normalizedOptional(body.EnrolledAt)
	body.StatusChangeReason = normalizedOptional(body.StatusChangeReason)
	address, err := mail.ParseAddress(body.Email)
	if err != nil || address.Address != body.Email {
		return WriteInput{}, "A valid email is required"
	}
	if len(body.Email) > 320 {
		return WriteInput{}, "Email is too long"
	}
	if create && len(body.Password) < 8 {
		return WriteInput{}, "temporary_password must be at least 8 characters"
	}
	if !create && body.Password != "" {
		return WriteInput{}, "temporary_password cannot be changed through this endpoint"
	}
	if body.FullName == "" || len(body.FullName) > 160 {
		return WriteInput{}, "full_name is required and must be at most 160 characters"
	}
	if body.Phone != nil && len(*body.Phone) > 30 {
		return WriteInput{}, "phone must be at most 30 characters"
	}
	if body.Gender != nil && !validGender(*body.Gender) {
		return WriteInput{}, "gender must be male, female, other, or unspecified"
	}
	if body.Address != nil && len(*body.Address) > 500 {
		return WriteInput{}, "address must be at most 500 characters"
	}
	if body.EmergencyContactName != nil && len(*body.EmergencyContactName) > 160 {
		return WriteInput{}, "emergency_contact_name must be at most 160 characters"
	}
	if body.EmergencyContactPhone != nil && len(*body.EmergencyContactPhone) > 30 {
		return WriteInput{}, "emergency_contact_phone must be at most 30 characters"
	}
	if body.StatusChangeReason != nil && len(*body.StatusChangeReason) > 500 {
		return WriteInput{}, "status_change_reason must be at most 500 characters"
	}
	if !validOptionalDate(body.DateOfBirth) || !validOptionalDate(body.EnrolledAt) {
		return WriteInput{}, "date_of_birth and enrolled_at must use YYYY-MM-DD"
	}
	if !validUserStatus(body.AccountStatus) || !validStudentStatus(body.Status) {
		return WriteInput{}, "Invalid account_status or student status"
	}
	return WriteInput{
		Email: body.Email, Password: body.Password,
		AccountStatus: db.UserStatus(body.AccountStatus),
		FullName:      body.FullName,
		Phone:         body.Phone, DateOfBirth: body.DateOfBirth,
		Gender: body.Gender, Address: body.Address,
		EmergencyContactName:  body.EmergencyContactName,
		EmergencyContactPhone: body.EmergencyContactPhone,
		Status:                db.StudentStatus(body.Status), EnrolledAt: body.EnrolledAt,
		StatusChangeReason: body.StatusChangeReason,
	}, ""
}

func normalizedOptional(value *string) *string {
	if value == nil {
		return nil
	}
	normalized := strings.TrimSpace(*value)
	if normalized == "" {
		return nil
	}
	return &normalized
}

func validGender(value string) bool {
	switch value {
	case "male", "female", "other", "unspecified":
		return true
	default:
		return false
	}
}

func pointerValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func csvSafe(value string) string {
	if value != "" && strings.ContainsRune("=+-@", rune(value[0])) {
		return "'" + value
	}
	return value
}

func optionalCSV(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func importFailureMessage(err error) string {
	switch {
	case err == nil:
		return ""
	case errors.Is(err, ErrEmailConflict):
		return "Email đã tồn tại"
	case errors.Is(err, ErrCodeConflict):
		return "Mã học viên đã tồn tại"
	default:
		return "Không thể tạo học viên"
	}
}

func validOptionalDate(value *string) bool {
	if value == nil || *value == "" {
		return true
	}
	_, err := time.Parse("2006-01-02", *value)
	return err == nil
}

func validUserStatus(value string) bool {
	switch db.UserStatus(value) {
	case db.UserStatusPending, db.UserStatusActive, db.UserStatusSuspended, db.UserStatusInactive:
		return true
	default:
		return false
	}
}

func validStudentStatus(value string) bool {
	switch db.StudentStatus(value) {
	case db.StudentStatusPending, db.StudentStatusActive, db.StudentStatusSuspended,
		db.StudentStatusCompleted, db.StudentStatusWithdrawn:
		return true
	default:
		return false
	}
}
