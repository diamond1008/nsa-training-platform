package reports

import "testing"

func TestCSVSafe(t *testing.T) {
	cases := map[string]string{
		"normal":  "normal",
		"=1+1":    "'=1+1",
		"  +cmd":  "'  +cmd",
		"@SUM(A)": "'@SUM(A)",
	}
	for input, want := range cases {
		if got := csvSafe(input); got != want {
			t.Errorf("csvSafe(%q)=%q, want %q", input, got, want)
		}
	}
}
