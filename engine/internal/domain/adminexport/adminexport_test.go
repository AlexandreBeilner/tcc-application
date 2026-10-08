package adminexport

import "testing"

func TestClampLimit(t *testing.T) {
	tests := []struct{ in, want int }{
		{0, DefaultRows},
		{-5, DefaultRows},
		{1, 1},
		{MaxRows, MaxRows},
		{MaxRows + 1, MaxRows},
		{10_000_000, MaxRows},
	}
	for _, tt := range tests {
		if got := ClampLimit(tt.in); got != tt.want {
			t.Errorf("ClampLimit(%d) = %d; quer %d", tt.in, got, tt.want)
		}
	}
}
