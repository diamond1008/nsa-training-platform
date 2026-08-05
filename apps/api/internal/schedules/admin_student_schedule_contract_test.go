package schedules

import (
	"context"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/pagination"
)

var _ func(*Service, context.Context, string, ListFilter) (pagination.Result[SessionView], error) = (*Service).ListAdminStudent
