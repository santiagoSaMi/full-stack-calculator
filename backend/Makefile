.PHONY: test cover cover-html run clean

COVERAGE_PROFILE := coverage.out
COVERAGE_HTML    := coverage.html

## test: run all tests
test:
	go test ./...

## cover: run all tests and print coverage per function and in total
cover:
	go test -coverprofile=$(COVERAGE_PROFILE) ./...
	go tool cover -func=$(COVERAGE_PROFILE)

## cover-html: write an HTML report showing covered and uncovered lines
cover-html: cover
	go tool cover -html=$(COVERAGE_PROFILE) -o $(COVERAGE_HTML)
	@echo "Coverage report written to $(COVERAGE_HTML)"

## run: start the server (PORT defaults to 8080)
run:
	go run ./cmd/server

## clean: remove generated coverage files
clean:
	rm -f $(COVERAGE_PROFILE) $(COVERAGE_HTML)
