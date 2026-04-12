# Stage 1: Build
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Install dependencies for CGO (needed for some crypto libs)
RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o /bin/api ./cmd/api

# Stage 2: Run
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /bin/api .
COPY --from=builder /app/internal/db/migrations ./internal/db/migrations

EXPOSE 8080

CMD ["./api"]
