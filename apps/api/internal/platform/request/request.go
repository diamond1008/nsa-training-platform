// Package request contains small, transport-level HTTP parsing helpers.
package request

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

const maxBodyBytes = 1 << 20

// DecodeJSON decodes exactly one JSON object, rejects unknown fields, and
// limits the request body to 1 MiB.
func DecodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("request body must contain one JSON value")
	}
	return nil
}

// Page parses 1-based page/per_page query parameters with safe defaults.
func Page(r *http.Request) (page, perPage int, err error) {
	page, perPage = 1, 20
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		page, err = strconv.Atoi(raw)
		if err != nil || page < 1 {
			return 0, 0, errors.New("page must be a positive integer")
		}
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("per_page")); raw != "" {
		perPage, err = strconv.Atoi(raw)
		if err != nil || perPage < 1 || perPage > 100 {
			return 0, 0, errors.New("per_page must be between 1 and 100")
		}
	}
	return page, perPage, nil
}

// Sort parses an allowlisted sort key and direction. It never returns raw,
// unvalidated column names to callers.
func Sort(r *http.Request, defaultBy string, allowed ...string) (by, order string, err error) {
	by = strings.TrimSpace(r.URL.Query().Get("sort_by"))
	if by == "" {
		by = defaultBy
	}
	valid := false
	for _, candidate := range allowed {
		if by == candidate {
			valid = true
			break
		}
	}
	if !valid {
		return "", "", fmt.Errorf("sort_by must be one of: %s", strings.Join(allowed, ", "))
	}
	order = strings.ToLower(strings.TrimSpace(r.URL.Query().Get("sort_order")))
	if order == "" {
		order = "desc"
	}
	if order != "asc" && order != "desc" {
		return "", "", errors.New("sort_order must be asc or desc")
	}
	return by, order, nil
}
