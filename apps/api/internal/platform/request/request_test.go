package request

import (
	"net/http/httptest"
	"testing"
)

func TestSort(t *testing.T) {
	tests := []struct {
		name      string
		query     string
		wantBy    string
		wantOrder string
		wantErr   string
	}{
		{name: "defaults", query: "", wantBy: "created_at", wantOrder: "desc"},
		{name: "allowed ascending", query: "?sort_by=full_name&sort_order=asc", wantBy: "full_name", wantOrder: "asc"},
		{name: "rejects unknown column", query: "?sort_by=password_hash", wantErr: "sort_by must be one of: created_at, full_name, student_code"},
		{name: "rejects unknown direction", query: "?sort_order=sideways", wantErr: "sort_order must be asc or desc"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/students"+tt.query, nil)
			by, order, err := Sort(r, "created_at", "created_at", "full_name", "student_code")
			if tt.wantErr != "" {
				if err == nil || err.Error() != tt.wantErr {
					t.Fatalf("Sort error = %v, want %q", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("Sort returned error: %v", err)
			}
			if by != tt.wantBy || order != tt.wantOrder {
				t.Fatalf("Sort = (%q, %q), want (%q, %q)", by, order, tt.wantBy, tt.wantOrder)
			}
		})
	}
}
