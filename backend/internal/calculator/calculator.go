// Package calculator implements the arithmetic operations supported by the
// calculator service. It has no knowledge of HTTP or any other transport.
package calculator

import (
	"errors"
	"math"
)

// ErrDivisionByZero is returned when an operation would divide by zero:
// by Divide when the divisor is zero, and by Power when zero is raised to a
// negative exponent.
var ErrDivisionByZero = errors.New("division by zero")

// ErrNotRealNumber is returned by Power when the result is not a real
// number, which happens when a negative base is raised to a fractional
// exponent.
var ErrNotRealNumber = errors.New("result is not a real number")

// ErrNegativeSquareRoot is returned by Sqrt when its operand is negative.
var ErrNegativeSquareRoot = errors.New("square root of a negative number")

// Add returns the sum of a and b.
func Add(a, b float64) float64 {
	return a + b
}

// Subtract returns the difference of a and b (a - b).
func Subtract(a, b float64) float64 {
	return a - b
}

// Multiply returns the product of a and b.
func Multiply(a, b float64) float64 {
	return a * b
}

// Divide returns the quotient of a and b (a / b).
// It returns ErrDivisionByZero if b is zero.
func Divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, ErrDivisionByZero
	}
	return a / b, nil
}

// Power returns base raised to exponent.
//
// It returns ErrDivisionByZero if base is zero and exponent is negative
// (0^-n is 1/0^n), and ErrNotRealNumber if base is negative and exponent is
// not an integer. Zero raised to zero is 1, following the usual convention.
func Power(base, exponent float64) (float64, error) {
	if base == 0 && exponent < 0 {
		return 0, ErrDivisionByZero
	}
	if base < 0 && exponent != math.Trunc(exponent) {
		return 0, ErrNotRealNumber
	}
	return math.Pow(base, exponent), nil
}

// Sqrt returns the non-negative square root of x.
// It returns ErrNegativeSquareRoot if x is negative.
func Sqrt(x float64) (float64, error) {
	if x < 0 {
		return 0, ErrNegativeSquareRoot
	}
	if x == 0 {
		// Covers negative zero, whose square root would otherwise be -0.
		return 0, nil
	}
	return math.Sqrt(x), nil
}
