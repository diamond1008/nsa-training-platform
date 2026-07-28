package students

import "testing"

func TestValidateWriteRejectsInvalidDates(t *testing.T) {
	date := "25/07/2026"
	_, message := validateWrite(writeRequest{
		Email:         "student@test.local",
		Password:      "Passw0rd!123",
		AccountStatus: "active",
		FullName:      "Test Student",
		DateOfBirth:   &date,
		Status:        "active",
	}, true)
	if message == "" {
		t.Fatal("invalid date must be rejected")
	}
}

func TestValidateWriteDoesNotSilentlyAcceptPasswordOnUpdate(t *testing.T) {
	_, message := validateWrite(writeRequest{
		Email:         "student@test.local",
		Password:      "NewPassw0rd!",
		AccountStatus: "active",
		FullName:      "Test Student",
		Status:        "active",
	}, false)
	if message == "" {
		t.Fatal("password on profile update must be rejected")
	}
}

func TestValidateWriteAcceptsCreateWithoutStudentCode(t *testing.T) {
	input, message := validateWrite(writeRequest{
		Email:         "student@test.local",
		Password:      "Passw0rd!123",
		AccountStatus: "active",
		FullName:      "Test Student",
		Status:        "pending",
	}, true)
	if message != "" {
		t.Fatalf("valid create rejected: %s", message)
	}
	if input.StudentCode != "" {
		t.Fatalf("public create must leave generated student code empty, got %q", input.StudentCode)
	}
}

func TestValidateWriteNormalizesExtendedProfile(t *testing.T) {
	gender, address, reason := "female", "  12 Nguyễn Huệ  ", "  Chuyển trạng thái  "
	input, message := validateWrite(writeRequest{
		Email: "student@test.local", AccountStatus: "active", FullName: "Test Student",
		Status: "suspended", Gender: &gender, Address: &address, StatusChangeReason: &reason,
	}, false)
	if message != "" {
		t.Fatalf("valid extended profile rejected: %s", message)
	}
	if input.Address == nil || *input.Address != "12 Nguyễn Huệ" {
		t.Fatalf("address was not normalized: %#v", input.Address)
	}
	if input.StatusChangeReason == nil || *input.StatusChangeReason != "Chuyển trạng thái" {
		t.Fatalf("reason was not normalized: %#v", input.StatusChangeReason)
	}
}

func TestCSVSafePreventsSpreadsheetFormulaInjection(t *testing.T) {
	for _, value := range []string{"=SUM(1,1)", "+cmd", "-1+2", "@IMPORT"} {
		if got := csvSafe(value); got != "'"+value {
			t.Fatalf("csvSafe(%q) = %q", value, got)
		}
	}
	if got := csvSafe("HV00001"); got != "HV00001" {
		t.Fatalf("safe value changed to %q", got)
	}
}
