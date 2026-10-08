package orders

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/audit"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/data"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/pagination"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

type Service struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{
		pool:    pool,
		queries: db.New(pool),
	}
}

func (s *Service) Create(ctx context.Context, actorID string, input CreateInput) (View, error) {
	actorUUID, err := data.UUID(actorID)
	if err != nil {
		return View{}, fmt.Errorf("invalid actor ID: %w", err)
	}

	var leadID pgtype.UUID
	if input.LeadID != nil && *input.LeadID != "" {
		leadID, err = data.UUID(*input.LeadID)
		if err != nil {
			return View{}, fmt.Errorf("invalid lead ID: %w", err)
		}
	}

	var studentID pgtype.UUID
	if input.StudentID != nil && *input.StudentID != "" {
		studentID, err = data.UUID(*input.StudentID)
		if err != nil {
			return View{}, fmt.Errorf("invalid student ID: %w", err)
		}
	}

	var courseID pgtype.UUID
	if input.CourseID != nil && *input.CourseID != "" {
		courseID, err = data.UUID(*input.CourseID)
		if err != nil {
			return View{}, fmt.Errorf("invalid course ID: %w", err)
		}
	}

	var classID pgtype.UUID
	if input.ClassID != nil && *input.ClassID != "" {
		classID, err = data.UUID(*input.ClassID)
		if err != nil {
			return View{}, fmt.Errorf("invalid class ID: %w", err)
		}
	}

	amountNum, err := data.Numeric(input.Amount)
	if err != nil {
		return View{}, fmt.Errorf("invalid amount: %w", err)
	}
	discountNum, err := data.Numeric(input.DiscountAmount)
	if err != nil {
		return View{}, fmt.Errorf("invalid discount amount: %w", err)
	}
	finalNum, err := data.Numeric(input.Amount - input.DiscountAmount)
	if err != nil {
		return View{}, fmt.Errorf("invalid final amount: %w", err)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return View{}, fmt.Errorf("begin create order: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	q := s.queries.WithTx(tx)

	order, err := q.CreateOrder(ctx, db.CreateOrderParams{
		OrderCode:      "", // auto-generated sequence
		LeadID:         leadID,
		StudentID:      studentID,
		CourseID:       courseID,
		ClassID:        classID,
		Amount:         amountNum,
		DiscountAmount: discountNum,
		FinalAmount:    finalNum,
		DiscountNote:   data.Text(input.DiscountNote),
		Status:         db.OrderStatusPending,
		PaymentMethod:  data.Text(input.PaymentMethod),
		PaidAt:         pgtype.Timestamptz{},
		Notes:          data.Text(input.Notes),
		CreatedBy:      actorUUID,
	})
	if err != nil {
		return View{}, err
	}

	getOrder, err := q.GetOrder(ctx, order.ID)
	if err != nil {
		return View{}, fmt.Errorf("read created order: %w", err)
	}

	view := viewFromGetRow(getOrder)
	if err := audit.Write(ctx, q, actorID, "order.create", "order", order.ID, nil, view); err != nil {
		return View{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return View{}, fmt.Errorf("commit create order: %w", err)
	}

	return view, nil
}

func (s *Service) Get(ctx context.Context, orderIDValue string) (View, error) {
	orderID, err := data.UUID(orderIDValue)
	if err != nil {
		return View{}, ErrOrderNotFound
	}

	row, err := s.queries.GetOrder(ctx, orderID)
	if errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrOrderNotFound
	}
	if err != nil {
		return View{}, fmt.Errorf("get order: %w", err)
	}

	return viewFromGetRow(row), nil
}

func (s *Service) List(ctx context.Context, filter ListFilter) (ListResult, error) {
	search := strings.TrimSpace(filter.Search)

	var status db.NullOrderStatus
	if filter.Status != "" {
		status = db.NullOrderStatus{
			OrderStatus: db.OrderStatus(filter.Status),
			Valid:       true,
		}
	}

	var studentID pgtype.UUID
	if filter.StudentID != "" {
		parsed, err := data.UUID(filter.StudentID)
		if err == nil {
			studentID = parsed
		}
	}

	var leadID pgtype.UUID
	if filter.LeadID != "" {
		parsed, err := data.UUID(filter.LeadID)
		if err == nil {
			leadID = parsed
		}
	}

	var createdFrom pgtype.Timestamptz
	if filter.CreatedFrom != "" {
		t, err := time.Parse(time.RFC3339, filter.CreatedFrom)
		if err == nil {
			createdFrom = pgtype.Timestamptz{Time: t, Valid: true}
		}
	}

	var createdTo pgtype.Timestamptz
	if filter.CreatedTo != "" {
		t, err := time.Parse(time.RFC3339, filter.CreatedTo)
		if err == nil {
			createdTo = pgtype.Timestamptz{Time: t, Valid: true}
		}
	}

	page := filter.Page
	if page < 1 {
		page = 1
	}
	perPage := filter.PerPage
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	rows, err := s.queries.ListOrders(ctx, db.ListOrdersParams{
		Search:      search,
		Status:      status,
		StudentID:   studentID,
		LeadID:      leadID,
		CreatedFrom: createdFrom,
		CreatedTo:   createdTo,
		PageOffset:  int32(offset),
		PageLimit:   int32(perPage),
	})
	if err != nil {
		return pagination.Result[View]{}, fmt.Errorf("list orders: %w", err)
	}

	total, err := s.queries.CountOrders(ctx, db.CountOrdersParams{
		Search:      search,
		Status:      status,
		StudentID:   studentID,
		LeadID:      leadID,
		CreatedFrom: createdFrom,
		CreatedTo:   createdTo,
	})
	if err != nil {
		return pagination.Result[View]{}, fmt.Errorf("count orders: %w", err)
	}

	items := make([]View, 0, len(rows))
	for _, row := range rows {
		items = append(items, viewFromListRow(row))
	}

	return pagination.New(items, page, perPage, total), nil
}

func (s *Service) UpdateStatus(ctx context.Context, actorID string, orderIDValue string, input UpdateStatusInput) (View, error) {
	orderID, err := data.UUID(orderIDValue)
	if err != nil {
		return View{}, ErrOrderNotFound
	}

	targetStatus := db.OrderStatus(input.Status)
	if !isValidOrderStatus(targetStatus) {
		return View{}, ErrInvalidStatus
	}

	existing, err := s.queries.GetOrder(ctx, orderID)
	if errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrOrderNotFound
	}
	if err != nil {
		return View{}, fmt.Errorf("get order for status update: %w", err)
	}

	var paidAt pgtype.Timestamptz
	if targetStatus == db.OrderStatusPaid {
		paidAt = pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
	} else if existing.PaidAt.Valid {
		paidAt = existing.PaidAt
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return View{}, fmt.Errorf("begin update order status: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	q := s.queries.WithTx(tx)

	_, err = q.UpdateOrderStatus(ctx, db.UpdateOrderStatusParams{
		ID:     orderID,
		Status: targetStatus,
		PaidAt: paidAt,
	})
	if err != nil {
		return View{}, err
	}

	updated, err := q.GetOrder(ctx, orderID)
	if err != nil {
		return View{}, fmt.Errorf("read updated order: %w", err)
	}

	view := viewFromGetRow(updated)
	if err := audit.Write(ctx, q, actorID, "order.update_status", "order", orderID, viewFromGetRow(existing), view); err != nil {
		return View{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return View{}, fmt.Errorf("commit update order status: %w", err)
	}

	return view, nil
}

func (s *Service) RevenueReport(ctx context.Context) (RevenueReportView, error) {
	summaryRow, err := s.queries.GetRevenueSummary(ctx)
	if err != nil {
		return RevenueReportView{}, fmt.Errorf("get revenue summary: %w", err)
	}

	monthlyRows, err := s.queries.GetRevenueByMonth(ctx)
	if err != nil {
		return RevenueReportView{}, fmt.Errorf("get revenue by month: %w", err)
	}

	sourceRows, err := s.queries.GetRevenueBySource(ctx)
	if err != nil {
		return RevenueReportView{}, fmt.Errorf("get revenue by source: %w", err)
	}

	byMonth := make([]MonthlyRevenue, 0, len(monthlyRows))
	for _, m := range monthlyRows {
		byMonth = append(byMonth, MonthlyRevenue{
			Month:        m.Month,
			TotalOrders:  m.TotalOrders,
			PaidOrders:   m.PaidOrders,
			TotalRevenue: data.NumericFloat(m.TotalRevenue),
		})
	}

	bySource := make([]SourceRevenue, 0, len(sourceRows))
	for _, sr := range sourceRows {
		bySource = append(bySource, SourceRevenue{
			Source:      string(sr.Source),
			TotalOrders: sr.TotalOrders,
			Revenue:     data.NumericFloat(sr.Revenue),
		})
	}

	return RevenueReportView{
		Summary: RevenueSummary{
			MonthRevenue:    data.NumericFloat(summaryRow.MonthRevenue),
			TotalRevenue:    data.NumericFloat(summaryRow.TotalRevenue),
			MonthOrders:     summaryRow.MonthOrders,
			MonthPaidOrders: summaryRow.MonthPaidOrders,
		},
		ByMonth:  byMonth,
		BySource: bySource,
	}, nil
}

func viewFromGetRow(r db.GetOrderRow) View {
	var paidAt *string
	if r.PaidAt.Valid {
		s := r.PaidAt.Time.UTC().Format(time.RFC3339)
		paidAt = &s
	}

	return View{
		ID:             data.UUIDString(r.ID),
		OrderCode:      r.OrderCode,
		LeadID:         data.UUIDPointer(r.LeadID),
		LeadName:       data.TextPointer(r.LeadName),
		StudentID:      data.UUIDPointer(r.StudentID),
		StudentCode:    data.TextPointer(r.StudentCode),
		StudentName:    data.TextPointer(r.StudentName),
		CourseID:       data.UUIDPointer(r.CourseID),
		CourseCode:     data.TextPointer(r.CourseCode),
		CourseName:     data.TextPointer(r.CourseName),
		ClassID:        data.UUIDPointer(r.ClassID),
		ClassCode:      data.TextPointer(r.ClassCode),
		ClassName:      data.TextPointer(r.ClassName),
		Amount:         data.NumericFloat(r.Amount),
		DiscountAmount: data.NumericFloat(r.DiscountAmount),
		FinalAmount:    data.NumericFloat(r.FinalAmount),
		DiscountNote:   data.TextPointer(r.DiscountNote),
		Status:         string(r.Status),
		PaymentMethod:  data.TextPointer(r.PaymentMethod),
		PaidAt:         paidAt,
		Notes:          data.TextPointer(r.Notes),
		CreatedBy:      data.UUIDString(r.CreatedBy),
		CreatedByEmail: data.TextPointer(r.CreatedByEmail),
		CreatedAt:      r.CreatedAt.Time.UTC().Format(time.RFC3339),
		UpdatedAt:      r.UpdatedAt.Time.UTC().Format(time.RFC3339),
	}
}

func viewFromListRow(r db.ListOrdersRow) View {
	var paidAt *string
	if r.PaidAt.Valid {
		s := r.PaidAt.Time.UTC().Format(time.RFC3339)
		paidAt = &s
	}

	return View{
		ID:             data.UUIDString(r.ID),
		OrderCode:      r.OrderCode,
		LeadID:         data.UUIDPointer(r.LeadID),
		LeadName:       data.TextPointer(r.LeadName),
		StudentID:      data.UUIDPointer(r.StudentID),
		StudentCode:    data.TextPointer(r.StudentCode),
		StudentName:    data.TextPointer(r.StudentName),
		CourseID:       data.UUIDPointer(r.CourseID),
		CourseCode:     data.TextPointer(r.CourseCode),
		CourseName:     data.TextPointer(r.CourseName),
		ClassID:        data.UUIDPointer(r.ClassID),
		ClassCode:      data.TextPointer(r.ClassCode),
		ClassName:      data.TextPointer(r.ClassName),
		Amount:         data.NumericFloat(r.Amount),
		DiscountAmount: data.NumericFloat(r.DiscountAmount),
		FinalAmount:    data.NumericFloat(r.FinalAmount),
		DiscountNote:   data.TextPointer(r.DiscountNote),
		Status:         string(r.Status),
		PaymentMethod:  data.TextPointer(r.PaymentMethod),
		PaidAt:         paidAt,
		Notes:          data.TextPointer(r.Notes),
		CreatedBy:      data.UUIDString(r.CreatedBy),
		CreatedByEmail: data.TextPointer(r.CreatedByEmail),
		CreatedAt:      r.CreatedAt.Time.UTC().Format(time.RFC3339),
		UpdatedAt:      r.UpdatedAt.Time.UTC().Format(time.RFC3339),
	}
}

func isValidOrderStatus(s db.OrderStatus) bool {
	switch s {
	case db.OrderStatusPending,
		db.OrderStatusPaid,
		db.OrderStatusCancelled,
		db.OrderStatusRefunded:
		return true
	default:
		return false
	}
}
