# syntax=docker/dockerfile:1

# One image that runs the whole application in a single container: nginx
# serves the frontend and forwards /api/ to the Go API beside it.
#
#   docker build -t calculator .
#   docker run --rm -p 3000:8080 calculator      # then open http://localhost:3000
#
# For one container per service, use compose.yaml instead.

# ---- Build the API: a static Go binary ---------------------------------
FROM golang:1.27-alpine AS backend-build
WORKDIR /src
COPY backend/go.mod backend/go.sum* ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# ---- Build the frontend: static files ----------------------------------
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Left empty so the app calls the API on the origin that served the page.
ENV VITE_API_BASE_URL=""
RUN npm run build

# ---- Run: nginx and the API together -----------------------------------
# The unprivileged image runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.29-alpine

# The same nginx configuration as the frontend image. start.sh points its
# BACKEND_URL at the API inside this container.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
ENV NGINX_ENVSUBST_FILTER="^(BACKEND_URL|NGINX_LOCAL_RESOLVERS)$"
COPY frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template

COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY --from=backend-build /out/server /usr/local/bin/calculator-server
COPY --chmod=755 docker/start.sh /usr/local/bin/start.sh

EXPOSE 8080

# Healthy only when the page is served and the API answers.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ && wget -q --spider http://127.0.0.1:8081/health

# start.sh handles SIGTERM itself and stops both processes.
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/local/bin/start.sh"]
CMD []
