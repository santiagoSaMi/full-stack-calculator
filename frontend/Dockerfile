# syntax=docker/dockerfile:1

# ---- Build: type-check and bundle the app ------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first, so this layer is cached until the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Base URL the app calls the API on. Empty (the default) means "the same
# origin that served the page", which is what the nginx proxy below expects.
# Set it only to serve the API from a different origin.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# ---- Run: nginx serving the static files -------------------------------
# The unprivileged image runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.29-alpine

# Where /api requests are forwarded. Read when the container starts, so one
# image works with any backend address. The default matches the service name
# in compose.yaml.
ENV BACKEND_URL=http://backend:8080
# Have the entrypoint export the container's DNS servers as
# NGINX_LOCAL_RESOLVERS, which the template uses to look up the backend.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
# Substitute only these two values in the template, never nginx's own $variables.
ENV NGINX_ENVSUBST_FILTER="^(BACKEND_URL|NGINX_LOCAL_RESOLVERS)$"

# The image's entrypoint renders templates into /etc/nginx/conf.d at start.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
