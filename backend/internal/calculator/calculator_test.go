package calculator

import (
	"errors"
	"math"
	"testing"
)

// tolerance is the relative error allowed when comparing results that
// cannot be represented exactly in binary floating point (e.g. 0.1 + 0.2).
const tolerance = 1e-9

// approxEqual reports whether got and want are equal within tolerance,
// relative to the magnitude of want (absolute near zero).
func approxEqual(got, want float64) bool {
	if got == want {
		return true
	}
	return math.Abs(got-want) <= tolerance*math.Max(1, math.Abs(want))
}

// binaryCase is a test case for an operation that cannot fail.
type binaryCase struct {
	name string
	a, b float64
	want float64
}

func runBinaryCases(t *testing.T, op string, fn func(a, b float64) float64, tests []binaryCase) {
	t.Helper()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := fn(tt.a, tt.b); !approxEqual(got, tt.want) {
				t.Errorf("%s(%v, %v) = %v, want %v", op, tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestAdd(t *testing.T) {
	runBinaryCases(t, "Add", Add, []binaryCase{
		// Positive values.
		{"two positives", 2, 3, 5},
		{"large positives", 1e15, 2e15, 3e15},

		// Negative values.
		{"two negatives", -2, -3, -5},
		{"negative plus positive", -2, 3, 1},
		{"positive plus negative", 2, -3, -1},
		{"opposites cancel", 7, -7, 0},

		// Zero values.
		{"zero plus zero", 0, 0, 0},
		{"zero plus positive", 0, 5, 5},
		{"positive plus zero", 5, 0, 5},
		{"zero plus negative", 0, -5, -5},

		// Decimal values.
		{"exact decimals", 1.5, 2.25, 3.75},
		{"inexact decimals", 0.1, 0.2, 0.3},
		{"negative decimals", -1.25, -0.75, -2},
		{"decimal and integer", 2.5, 1, 3.5},
		{"small decimals", 0.0001, 0.0002, 0.0003},
	})
}

func TestSubtract(t *testing.T) {
	runBinaryCases(t, "Subtract", Subtract, []binaryCase{
		// Positive values.
		{"positive result", 5, 3, 2},
		{"negative result", 3, 5, -2},
		{"equal values", 4, 4, 0},

		// Negative values.
		{"two negatives", -2, -3, 1},
		{"negative minus positive", -2, 3, -5},
		{"positive minus negative", 2, -3, 5},

		// Zero values.
		{"zero minus zero", 0, 0, 0},
		{"positive minus zero", 5, 0, 5},
		{"zero minus positive", 0, 5, -5},
		{"zero minus negative", 0, -5, 5},

		// Decimal values.
		{"exact decimals", 5.5, 2.25, 3.25},
		{"inexact decimals", 0.3, 0.1, 0.2},
		{"negative decimals", -1.5, -0.25, -1.25},
		{"decimal result from integers", 1, 0.5, 0.5},
	})
}

func TestMultiply(t *testing.T) {
	runBinaryCases(t, "Multiply", Multiply, []binaryCase{
		// Positive values.
		{"two positives", 4, 3, 12},
		{"by one", 9, 1, 9},
		{"large values", 1e10, 1e5, 1e15},

		// Negative values.
		{"negative times positive", -4, 3, -12},
		{"positive times negative", 4, -3, -12},
		{"two negatives", -4, -3, 12},
		{"by negative one", 9, -1, -9},

		// Zero values.
		{"zero times zero", 0, 0, 0},
		{"positive times zero", 7, 0, 0},
		{"zero times positive", 0, 7, 0},
		{"negative times zero", -7, 0, 0},

		// Decimal values.
		{"exact decimals", 1.5, 2, 3},
		{"inexact decimals", 0.1, 3, 0.3},
		{"two decimals", 0.5, 0.5, 0.25},
		{"negative decimals", -2.5, -0.4, 1},
	})
}

func TestDivide(t *testing.T) {
	tests := []binaryCase{
		// Positive values.
		{"exact quotient", 10, 2, 5},
		{"fractional quotient", 1, 4, 0.25},
		{"repeating quotient", 1, 3, 0.3333333333333333},
		{"by one", 9, 1, 9},
		{"equal values", 6, 6, 1},

		// Negative values.
		{"negative by positive", -9, 3, -3},
		{"positive by negative", 9, -3, -3},
		{"two negatives", -9, -3, 3},

		// Zero values.
		{"zero by positive", 0, 5, 0},
		{"zero by negative", 0, -5, 0},

		// Decimal values.
		{"exact decimals", 7.5, 2.5, 3},
		{"inexact decimals", 0.3, 0.1, 3},
		{"by a decimal", 1, 0.5, 2},
		{"negative decimals", -1.5, -0.5, 3},
		{"small divisor", 1, 1e-10, 1e10},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Divide(tt.a, tt.b)
			if err != nil {
				t.Fatalf("Divide(%v, %v) unexpected error: %v", tt.a, tt.b, err)
			}
			if !approxEqual(got, tt.want) {
				t.Errorf("Divide(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestDivideByZero(t *testing.T) {
	negativeZero := math.Copysign(0, -1)
	tests := []struct {
		name string
		a, b float64
	}{
		{"positive by zero", 5, 0},
		{"negative by zero", -5, 0},
		{"zero by zero", 0, 0},
		{"decimal by zero", 2.5, 0},
		{"positive by negative zero", 5, negativeZero},
		{"negative by negative zero", -5, negativeZero},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Divide(tt.a, tt.b)
			if !errors.Is(err, ErrDivisionByZero) {
				t.Fatalf("Divide(%v, %v) error = %v, want %v", tt.a, tt.b, err, ErrDivisionByZero)
			}
			if got != 0 {
				t.Errorf("Divide(%v, %v) = %v, want 0 on error", tt.a, tt.b, got)
			}
		})
	}
}

func TestErrDivisionByZeroMessage(t *testing.T) {
	if got, want := ErrDivisionByZero.Error(), "division by zero"; got != want {
		t.Errorf("ErrDivisionByZero.Error() = %q, want %q", got, want)
	}
}

func TestApproxEqual(t *testing.T) {
	tests := []struct {
		name      string
		got, want float64
		equal     bool
	}{
		{"identical", 1, 1, true},
		{"float rounding", 0.1 + 0.2, 0.3, true},
		{"clearly different", 0.3, 0.31, false},
		{"near zero", 1e-12, 0, true},
		{"large relative match", 1e15 + 0.1, 1e15, true},
		{"large relative mismatch", 1.001e15, 1e15, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := approxEqual(tt.got, tt.want); got != tt.equal {
				t.Errorf("approxEqual(%v, %v) = %v, want %v", tt.got, tt.want, got, tt.equal)
			}
		})
	}
}
