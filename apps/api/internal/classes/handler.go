package classes

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/auth"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/data"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/request"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/response"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

type Handler struct {
	service *Service
	log     *slog.Logger
}

func NewHandler(service *Service, log *slog.Logger) *Handler {
	return &Handler{service: service, log: log}
}

type writeRequest struct {
	CourseID        string `json:"course_id"`
	ClassCode       string `json:"class_code"`
	Name            string `json:"name"`
	StartDate       string `json:"start_date"`
	EndDate         string `json:"end_date"`
	MaximumStudents int32  `json:"maximum_students"`
	Status          string `json:"status"`
}

type enrollmentRequest struct {
	StudentID string `json:"student_id"`
}

type enrollmentStatusRequest struct {
	Status string `json:"status"`
}

type assignmentRequest struct {
	TeacherID      string `json:"teacher_id"`
	AssignmentRole string `json:"assignment_role"`
}

type assignmentUpdateRequest struct {
	AssignmentRole string `json:"assignment_role"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	input, ok := h.decodeClass(w, r)
	if !ok {
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.Create(r.Context(), actorID, input)
	h.writeClass(w, r, view, err, true)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	view, err := h.service.Get(r.Context(), chi.URLParam(r, "classID"))
	h.writeClass(w, r, view, err, false)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	page, perPage, err := request.Page(r)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status != "" && !validClassStatus(status) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid class status")
		return
	}
	courseID := strings.TrimSpace(r.URL.Query().Get("course_id"))
	if courseID != "" {
		if _, err := data.UUID(courseID); err != nil {
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "course_id must be a valid UUID")
			return
		}
	}
	result, err := h.service.List(
		r.Context(), r.URL.Query().Get("search"), status,
		courseID, page, perPage,
	)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, result)
}

func (h *Handler) ListTeacherClasses(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFrom(r.Context())
	items, err := h.service.ListTeacher(r.Context(), userID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, items)
}

func (h *Handler) GetTeacherClass(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.GetTeacherClass(r.Context(), userID, chi.URLParam(r, "classID"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	input, ok := h.decodeClass(w, r)
	if !ok {
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.Update(r.Context(), actorID, chi.URLParam(r, "classID"), input)
	h.writeClass(w, r, view, err, false)
}

func (h *Handler) Enroll(w http.ResponseWriter, r *http.Request) {
	var body enrollmentRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	if strings.TrimSpace(body.StudentID) == "" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "student_id is required")
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.Enroll(r.Context(), actorID, chi.URLParam(r, "classID"), body.StudentID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.Created(w, view)
}

func (h *Handler) ListEnrollments(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.ListEnrollments(r.Context(), chi.URLParam(r, "classID"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, items)
}

func (h *Handler) UpdateEnrollment(w http.ResponseWriter, r *http.Request) {
	var body enrollmentStatusRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	if !validEnrollmentStatus(body.Status) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid enrollment status")
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.UpdateEnrollment(
		r.Context(), actorID, chi.URLParam(r, "classID"), chi.URLParam(r, "enrollmentID"),
		db.EnrollmentStatus(body.Status),
	)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) AssignTeacher(w http.ResponseWriter, r *http.Request) {
	var body assignmentRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	body.AssignmentRole = strings.TrimSpace(body.AssignmentRole)
	if body.TeacherID == "" || body.AssignmentRole == "" || len(body.AssignmentRole) > 80 {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "teacher_id and a valid assignment_role are required")
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.AssignTeacher(
		r.Context(), actorID, chi.URLParam(r, "classID"), body.TeacherID, body.AssignmentRole,
	)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.Created(w, view)
}

func (h *Handler) ListAssignments(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.ListAssignments(r.Context(), chi.URLParam(r, "classID"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, items)
}

func (h *Handler) UpdateAssignment(w http.ResponseWriter, r *http.Request) {
	var body assignmentUpdateRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	body.AssignmentRole = strings.TrimSpace(body.AssignmentRole)
	if body.AssignmentRole == "" || len(body.AssignmentRole) > 80 {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "A valid assignment_role is required")
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.UpdateAssignment(
		r.Context(), actorID, chi.URLParam(r, "classID"), chi.URLParam(r, "assignmentID"),
		body.AssignmentRole,
	)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) DeleteAssignment(w http.ResponseWriter, r *http.Request) {
	actorID, _ := auth.UserIDFrom(r.Context())
	err := h.service.DeleteAssignment(
		r.Context(), actorID, chi.URLParam(r, "classID"), chi.URLParam(r, "assignmentID"),
	)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, map[string]string{"message": "Teacher assignment removed"})
}

func (h *Handler) decodeClass(w http.ResponseWriter, r *http.Request) (WriteInput, bool) {
	var body writeRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return WriteInput{}, false
	}
	body.CourseID, body.ClassCode, body.Name = strings.TrimSpace(body.CourseID), strings.TrimSpace(body.ClassCode), strings.TrimSpace(body.Name)
	body.Status = strings.TrimSpace(body.Status)
	start, startErr := time.Parse("2006-01-02", body.StartDate)
	end, endErr := time.Parse("2006-01-02", body.EndDate)
	if body.CourseID == "" || body.ClassCode == "" || len(body.ClassCode) > 40 ||
		body.Name == "" || len(body.Name) > 200 || startErr != nil || endErr != nil ||
		end.Before(start) || body.MaximumStudents <= 0 || !validClassStatus(body.Status) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid course, code, name, dates, capacity, or status")
		return WriteInput{}, false
	}
	return WriteInput{
		CourseID: body.CourseID, ClassCode: body.ClassCode, Name: body.Name,
		StartDate: body.StartDate, EndDate: body.EndDate,
		MaximumStudents: body.MaximumStudents, Status: db.ClassStatus(body.Status),
	}, true
}

func validClassStatus(value string) bool {
	switch db.ClassStatus(value) {
	case db.ClassStatusPlanning, db.ClassStatusOpen, db.ClassStatusInProgress,
		db.ClassStatusCompleted, db.ClassStatusCancelled, db.ClassStatusArchived:
		return true
	default:
		return false
	}
}

func validEnrollmentStatus(value string) bool {
	switch db.EnrollmentStatus(value) {
	case db.EnrollmentStatusEnrolled, db.EnrollmentStatusTransferred,
		db.EnrollmentStatusCompleted, db.EnrollmentStatusWithdrawn:
		return true
	default:
		return false
	}
}

func (h *Handler) writeClass(w http.ResponseWriter, r *http.Request, view View, err error, created bool) {
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	if created {
		response.Created(w, view)
	} else {
		response.OK(w, view)
	}
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrClassNotFound):
		response.Fail(w, http.StatusNotFound, "CLASS_NOT_FOUND", "Class not found")
	case errors.Is(err, ErrCourseNotFound):
		response.Fail(w, http.StatusNotFound, "COURSE_NOT_FOUND", "Course not found")
	case errors.Is(err, ErrStudentNotFound):
		response.Fail(w, http.StatusNotFound, "STUDENT_NOT_FOUND", "Student not found")
	case errors.Is(err, ErrTeacherNotFound):
		response.Fail(w, http.StatusNotFound, "TEACHER_NOT_FOUND", "Teacher not found")
	case errors.Is(err, ErrTeacherNotAssigned):
		response.Fail(w, http.StatusForbidden, "TEACHER_NOT_ASSIGNED", "Teacher is not assigned to this class")
	case errors.Is(err, ErrEnrollmentNotFound):
		response.Fail(w, http.StatusNotFound, "ENROLLMENT_NOT_FOUND", "Enrollment not found")
	case errors.Is(err, ErrAssignmentNotFound):
		response.Fail(w, http.StatusNotFound, "ASSIGNMENT_NOT_FOUND", "Teacher assignment not found")
	case errors.Is(err, ErrClassConflict):
		response.Fail(w, http.StatusConflict, "CLASS_CODE_ALREADY_EXISTS", "Class code already exists")
	case errors.Is(err, ErrDuplicateEnrollment):
		response.Fail(w, http.StatusConflict, "DUPLICATE_ENROLLMENT", "Student is already enrolled in this class")
	case errors.Is(err, ErrClassFull):
		response.Fail(w, http.StatusConflict, "CLASS_CAPACITY_REACHED", "Class has reached maximum capacity")
	case errors.Is(err, ErrCapacityBelowCount):
		response.Fail(w, http.StatusConflict, "CAPACITY_BELOW_ENROLLMENT", "Maximum students cannot be below current enrollment")
	case errors.Is(err, ErrDuplicateAssignment):
		response.Fail(w, http.StatusConflict, "DUPLICATE_TEACHER_ASSIGNMENT", "Teacher is already assigned to this class")
	case errors.Is(err, ErrAssignmentInUse):
		response.Fail(w, http.StatusConflict, "ASSIGNMENT_IN_USE", "Teacher assignment is referenced by class sessions")
	case errors.Is(err, ErrStudentInactive):
		response.Fail(w, http.StatusConflict, "STUDENT_INACTIVE", "Only active students can be enrolled")
	case errors.Is(err, ErrTeacherInactive):
		response.Fail(w, http.StatusConflict, "TEACHER_INACTIVE", "Only active teachers can be assigned")
	case errors.Is(err, ErrClassNotEnrollable):
		response.Fail(w, http.StatusConflict, "CLASS_STATUS_INVALID", "Class status does not allow enrollment or assignment")
	default:
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
	}
}
