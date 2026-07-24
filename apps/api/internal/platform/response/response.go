// Package response defines the standard API JSON envelopes.
// Success: {"data": ..., "message": "Success"}
// Error:   {"error": {"code": "SOME_CODE", "message": "...", "details": ...}}
package response

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// Success is the standard success envelope.
type Success struct {
	Data    any    `json:"data"`
	Message string `json:"message"`
}

// ErrorBody is the error payload inside the error envelope.
type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

// Error is the standard error envelope.
type Error struct {
	Error ErrorBody `json:"error"`
}

// JSON writes any payload with the given status code.
func JSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// OK writes a 200 success envelope.
func OK(w http.ResponseWriter, data any) {
	JSON(w, http.StatusOK, Success{Data: data, Message: "Success"})
}

// Created writes a 201 success envelope.
func Created(w http.ResponseWriter, data any) {
	JSON(w, http.StatusCreated, Success{Data: data, Message: "Created"})
}

// Fail writes a standard error envelope without details.
func Fail(w http.ResponseWriter, status int, code, message string) {
	JSON(w, status, Error{Error: ErrorBody{Code: code, Message: message}})
}

// FailDetails writes a standard error envelope with details (e.g. validation errors).
func FailDetails(w http.ResponseWriter, status int, code, message string, details any) {
	JSON(w, status, Error{Error: ErrorBody{Code: code, Message: message, Details: details}})
}

// InternalError logs the real error and returns a generic 500 to the client.
// SQL errors, stack traces, and secrets must never reach the client.
func InternalError(w http.ResponseWriter, log *slog.Logger, requestID string, err error) {
	log.Error("internal error", "request_id", requestID, "error", err)
	Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
}
