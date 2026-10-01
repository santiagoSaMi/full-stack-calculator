# syntax=docker/dockerfile:1

# ---- Build: compile a static binary ------------------------------------
FROM golang:1.27-alpine AS build
WORKDIR /src

# Dependencies first, so this layer is cached until go.mod changes.
# (go.sum is optional: the module currently has no dependencies.)
COPY go.mod go.sum* ./
RUN go mod download

COPY . .
# CGO off gives a static binary that needs no C library at runtime;
# -trimpath and -s -w drop local paths and debug symbols.
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# ---- Run: the binary on a minimal base ---------------------------------
# Distroless "static" has no shell or package manager, only what a static
# binary needs (CA certificates, time zones, a non-root user).
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/server /server

ENV PORT=8080
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/server"]
