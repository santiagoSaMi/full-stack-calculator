// Package calculator implements the arithmetic operations supported by the
// calculator service. It has no knowledge of HTTP or any other transport.
package calculator

import "errors"

// ErrDivisionByZero is returned by Divide when the divisor is zero.
var ErrDivisionByZero = errors.New("division by zero")

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
