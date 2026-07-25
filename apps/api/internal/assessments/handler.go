package assessments

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/auth"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/data"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/request"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/response"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

const (
	maxAssessmentItems = 200
	maxOverallComment  = 2000
	maxItemComment     = 1000
)

type Handler struct {
	service *Service
	log     *slog.Logger
}

func NewHandler(service *Service, log *slog.Logger) *Handler {
	return &Handler{service: service, log: log}
}

type writeRequest struct {
	SessionID      *string       `json:"session_id"`
	OverallComment *string       `json:"overall_comment"`
	Items          []itemRequest `json:"items"`
}

type itemRequest struct {
	CriterionID string  `json:"competency_criterion_id"`
	Rating      string  `json:"rating"`
	Comment     *string `json:"comment"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	input, ok := h.decodeWrite(w, r)
	if !ok {
		return
	}
	userID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.Create(
		r.Context(), userID, chi.URLParam(r, "classID"), chi.URLParam(r, "studentID"), input,
	)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.Created(w, view)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	input, ok := h.decodeWrite(w, r)
	if !ok {
		return
	}
	userID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.Update(r.Context(), userID, chi.URLParam(r, "assessmentID"), input)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) Submit(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.Submit(r.Context(), userID, chi.URLParam(r, "assessmentID"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) Lock(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.Lock(r.Context(), userID, chi.URLParam(r, "assessmentID"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) GetTeacher(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.GetTeacher(r.Context(), userID, chi.URLParam(r, "assessmentID"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) ListTeacher(w http.ResponseWriter, r *http.Request) {
	page, perPage, err := request.Page(r)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}
	userID, _ := auth.UserIDFrom(r.Context())
	result, err := h.service.ListTeacher(
		r.Context(), userID, chi.URLParam(r, "classID"), chi.URLParam(r, "studentID"), page, perPage,
	)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, result)
}

func (h *Handler) ListStudent(w http.ResponseWriter, r *http.Request) {
	page, perPage, err := request.Page(r)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}
	classID := strings.TrimSpace(r.URL.Query().Get("class_id"))
	if classID != "" {
		if _, err := data.UUID(classID); err != nil {
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "class_id must be a valid UUID")
			return
		}
	}
	userID, _ := auth.UserIDFrom(r.Context())
	result, err := h.service.ListStudent(r.Context(), userID, classID, page, perPage)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, result)
}

func (h *Handler) GetStudent(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.GetStudent(r.Context(), userID, chi.URLParam(r, "assessmentID"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) decodeWrite(w http.ResponseWriter, r *http.Request) (WriteInput, bool) {
	var body writeRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return WriteInput{}, false
	}
	if len(body.Items) > maxAssessmentItems {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "items must not contain more than 200 entries")
		return WriteInput{}, false
	}
	overall, ok := normalizeOptional(body.OverallComment, maxOverallComment)
	if !ok {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "overall_comment must not exceed 2000 characters")
		return WriteInput{}, false
	}
	var sessionID *string
	if body.SessionID != nil {
		value := strings.TrimSpace(*body.SessionID)
		if value != "" {
			if _, err := data.UUID(value); err != nil {
				response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "session_id must be a valid UUID")
				return WriteInput{}, false
			}
			sessionID = &value
		}
	}
	items := make([]ItemInput, 0, len(body.Items))
	for index, item := range body.Items {
		criterionID := strings.TrimSpace(item.CriterionID)
		if _, err := data.UUID(criterionID); err != nil {
			response.FailDetails(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid assessment item", map[string]any{
				"index": index, "field": "competency_criterion_id", "message": "must be a valid UUID",
			})
			return WriteInput{}, false
		}
		rating, valid := competencyRating(item.Rating)
		if !valid {
			response.FailDetails(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid assessment item", map[string]any{
				"index": index, "field": "rating", "message": "invalid competency rating",
			})
			return WriteInput{}, false
		}
		comment, ok := normalizeOptional(item.Comment, maxItemComment)
		if !ok {
			response.FailDetails(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid assessment item", map[string]any{
				"index": index, "field": "comment", "message": "must not exceed 1000 characters",
			})
			return WriteInput{}, false
		}
		items = append(items, ItemInput{CriterionID: criterionID, Rating: rating, Comment: comment})
	}
	return WriteInput{SessionID: sessionID, OverallComment: overall, Items: items}, true
}

func competencyRating(value string) (db.CompetencyRating, bool) {
	switch db.CompetencyRating(strings.ToLower(strings.TrimSpace(value))) {
	case db.CompetencyRatingNotAssessed:
		return db.CompetencyRatingNotAssessed, true
	case db.CompetencyRatingNeedsImprovement:
		return db.CompetencyRatingNeedsImprovement, true
	case db.CompetencyRatingCompetent:
		return db.CompetencyRatingCompetent, true
	case db.CompetencyRatingGood:
		return db.CompetencyRatingGood, true
	case db.CompetencyRatingExcellent:
		return db.CompetencyRatingExcellent, true
	default:
		return "", false
	}
}

func normalizeOptional(value *string, maxRunes int) (*string, bool) {
	if value == nil {
		return nil, true
	}
	normalized := strings.TrimSpace(*value)
	if len([]rune(normalized)) > maxRunes {
		return nil, false
	}
	if normalized == "" {
		return nil, true
	}
	return &normalized, true
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrAssessmentNotFound):
		response.Fail(w, http.StatusNotFound, "ASSESSMENT_NOT_FOUND", "Assessment not found")
	case errors.Is(err, ErrTeacherNotAssigned):
		response.Fail(w, http.StatusForbidden, "TEACHER_NOT_ASSIGNED", "Teacher is not assigned to this class")
	case errors.Is(err, ErrAssessmentOwner):
		response.Fail(w, http.StatusForbidden, "ASSESSMENT_OWNER_REQUIRED", "Only the assessing teacher may change this assessment")
	case errors.Is(err, ErrStudentNotEnrolled):
		response.Fail(w, http.StatusUnprocessableEntity, "STUDENT_NOT_ENROLLED", "Student is not actively enrolled in this class")
	case errors.Is(err, ErrSessionMismatch):
		response.Fail(w, http.StatusBadRequest, "ASSESSMENT_SESSION_MISMATCH", "Session does not belong to this class and course")
	case errors.Is(err, ErrCriterionMismatch):
		response.Fail(w, http.StatusBadRequest, "COMPETENCY_COURSE_MISMATCH", "Competency criterion does not belong to this course")
	case errors.Is(err, ErrDuplicateCriterion):
		response.Fail(w, http.StatusBadRequest, "DUPLICATE_COMPETENCY", "A competency criterion appears more than once")
	case errors.Is(err, ErrAssessmentState):
		response.Fail(w, http.StatusConflict, "ASSESSMENT_STATE_CONFLICT", "Assessment state does not allow this operation")
	case errors.Is(err, ErrAssessmentIncomplete):
		response.Fail(w, http.StatusConflict, "ASSESSMENT_INCOMPLETE", "All required competencies must be rated before submission")
	case errors.Is(err, ErrAssessmentConflict):
		response.Fail(w, http.StatusConflict, "ASSESSMENT_ALREADY_EXISTS", "Assessment number already exists")
	default:
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
	}
}
