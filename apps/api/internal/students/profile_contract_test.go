package students

import "context"

var _ func(*Service, context.Context, string) (ProfileSummaryView, error) = (*Service).ProfileSummary
var _ func(*Service, context.Context, string, int, int) (ClassHistoryResult, error) = (*Service).ClassHistory
