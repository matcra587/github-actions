package fixture

import "testing"

func TestClamp(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		v    int
		lo   int
		hi   int
		want int
	}{
		{name: "below range", v: -5, lo: 0, hi: 10, want: 0},
		{name: "above range", v: 15, lo: 0, hi: 10, want: 10},
		{name: "inside range", v: 5, lo: 0, hi: 10, want: 5},
		{name: "at lower bound", v: 0, lo: 0, hi: 10, want: 0},
		{name: "at upper bound", v: 10, lo: 0, hi: 10, want: 10},
		{name: "negative range", v: -1, lo: -10, hi: -5, want: -5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := Clamp(tt.v, tt.lo, tt.hi); got != tt.want {
				t.Errorf("Clamp(%d, %d, %d) = %d, want %d", tt.v, tt.lo, tt.hi, got, tt.want)
			}
		})
	}
}

func TestAbs(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		v    int
		want int
	}{
		{name: "negative", v: -3, want: 3},
		{name: "positive", v: 7, want: 7},
		{name: "zero", v: 0, want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := Abs(tt.v); got != tt.want {
				t.Errorf("Abs(%d) = %d, want %d", tt.v, got, tt.want)
			}
		})
	}
}

func TestRepeat(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		s    string
		n    int
		want string
	}{
		{name: "repeats", s: "ab", n: 3, want: "ababab"},
		{name: "once", s: "go", n: 1, want: "go"},
		{name: "zero count", s: "ab", n: 0, want: ""},
		{name: "negative count", s: "ab", n: -2, want: ""},
		{name: "empty string", s: "", n: 4, want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := Repeat(tt.s, tt.n); got != tt.want {
				t.Errorf("Repeat(%q, %d) = %q, want %q", tt.s, tt.n, got, tt.want)
			}
		})
	}
}
