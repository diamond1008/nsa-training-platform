package students

import "testing"

func TestValidateWriteRejectsInvalidDates(t *testing.T) {
	date := "25/07/2026"
	_, message := validateWrite(writeRequest{
		Email:         "student@test.local",
		Password:      "Passw0rd!123",
		AccountStatus: "active",
		StudentCode:   "STU-001",
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
		StudentCode:   "STU-001",
		FullName:      "Test Student",
		Status:        "active",
	}, false)
	if message == "" {
		t.Fatal("password on profile update must be rejected")
	}
}
