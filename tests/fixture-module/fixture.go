// Package fixture exists solely to exercise the reusable go-ci.yml workflow
// in this repository's own CI (go-ci-selftest.yml). It is not project code:
// it gives the lint, test, race, coverage, and cross-compile jobs a real
// module to run against, so workflow changes are proven on a pull request
// before the fleet consumes them.
package fixture

import "strings"

// Clamp returns v constrained to the inclusive range [lo, hi].
func Clamp(v, lo, hi int) int {
	return min(max(v, lo), hi)
}

// Abs returns the absolute value of v.
func Abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}

// Repeat returns s repeated n times, or the empty string when n < 1.
func Repeat(s string, n int) string {
	if n < 1 {
		return ""
	}
	return strings.Repeat(s, n)
}
