package orders

import (
	"testing"

	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

func TestIsValidOrderStatus(t *testing.T) {
	validStatuses := []db.OrderStatus{
		db.OrderStatusPending,
		db.OrderStatusPaid,
		db.OrderStatusCancelled,
		db.OrderStatusRefunded,
	}

	for _, s := range validStatuses {
		if !isValidOrderStatus(s) {
			t.Errorf("expected status %s to be valid", s)
		}
	}

	if isValidOrderStatus("invalid_order_status") {
		t.Error("expected invalid status to be rejected")
	}
}
