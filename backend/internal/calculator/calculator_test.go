package calculator

import (
	"errors"
	"math"
	"testing"
)

func TestAdd(t *testing.T) {
	tests := []struct {
		name string
		a, b float64
		want float64
	}{
		{"positive numbers", 2, 3, 5},
		{"negative numbers", -2, -3, -5},
		{"mixed signs", -2, 3, 1},
		{"zero", 0, 0, 0},
		{"decimals", 1.5, 2.25, 3.75},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Add(tt.a, tt.b); got != tt.want {
				t.Errorf("Add(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestSubtract(t *testing.T) {
	tests := []struct {
		name string
		a, b float64
		want float64
	}{
		{"positive result", 5, 3, 2},
		{"negative result", 3, 5, -2},
		{"negative operands", -2, -3, 1},
		{"zero", 0, 0, 0},
		{"decimals", 5.5, 2.25, 3.25},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Subtract(tt.a, tt.b); got != tt.want {
				t.Errorf("Subtract(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestMultiply(t *testing.T) {
	tests := []struct {
		name string
		a, b float64
		want float64
	}{
		{"positive numbers", 4, 3, 12},
		{"mixed signs", -4, 3, -12},
		{"negative numbers", -4, -3, 12},
		{"by zero", 7, 0, 0},
		{"decimals", 1.5, 2, 3},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Multiply(tt.a, tt.b); got != tt.want {
				t.Errorf("Multiply(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestDivide(t *testing.T) {
	tests := []struct {
		name string
		a, b float64
		want float64
	}{
		{"exact", 10, 2, 5},
		{"fractional result", 1, 4, 0.25},
		{"mixed signs", -9, 3, -3},
		{"negative numbers", -9, -3, 3},
		{"zero dividend", 0, 5, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Divide(tt.a, tt.b)
			if err != nil {
				t.Fatalf("Divide(%v, %v) unexpected error: %v", tt.a, tt.b, err)
			}
			if got != tt.want {
				t.Errorf("Divide(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestDivideByZero(t *testing.T) {
	for _, a := range []float64{1, -1, 0} {
		for _, b := range []float64{0, math.Copysign(0, -1)} {
			got, err := Divide(a, b)
			if !errors.Is(err, ErrDivisionByZero) {
				t.Errorf("Divide(%v, %v) error = %v, want %v", a, b, err, ErrDivisionByZero)
			}
			if got != 0 {
				t.Errorf("Divide(%v, %v) = %v, want 0", a, b, got)
			}
		}
	}
}
