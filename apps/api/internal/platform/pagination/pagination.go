// Package pagination defines the standard list response shape.
package pagination

// Meta describes a 1-based page of results.
type Meta struct {
	Page       int   `json:"page"`
	PerPage    int   `json:"per_page"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

// Result wraps list items with pagination metadata.
type Result[T any] struct {
	Items []T  `json:"items"`
	Meta  Meta `json:"meta"`
}

// New creates a list result and calculates total pages.
func New[T any](items []T, page, perPage int, total int64) Result[T] {
	totalPages := 0
	if total > 0 {
		totalPages = int((total + int64(perPage) - 1) / int64(perPage))
	}
	return Result[T]{
		Items: items,
		Meta: Meta{
			Page:       page,
			PerPage:    perPage,
			Total:      total,
			TotalPages: totalPages,
		},
	}
}
