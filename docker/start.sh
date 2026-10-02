#!/bin/sh
# Runs the Go API and nginx in one container. If either one exits, the other
# is stopped and the container exits, so a half-working container never
# keeps running.
set -u

# Port the API listens on. Only nginx, in this same container, talks to it;
# the container publishes nginx's port (8080) and nothing else.
API_PORT=8081

PORT="$API_PORT" /usr/local/bin/calculator-server &
api=$!

# The nginx image's own entrypoint renders the configuration template, using
# BACKEND_URL as the address to forward /api/ to, and then becomes nginx.
BACKEND_URL="http://127.0.0.1:$API_PORT" /docker-entrypoint.sh nginx -g 'daemon off;' &
web=$!

stopping=0
trap 'stopping=1' TERM INT

# Wait until a stop is requested or either process exits. (BusyBox's
# "wait -n" waits for every job rather than the first, so poll instead.)
while [ "$stopping" = 0 ] && kill -0 "$api" 2>/dev/null && kill -0 "$web" 2>/dev/null; do
  sleep 1
done

# Stop whatever is still running: the API finishes in-flight requests first.
kill -TERM "$api" "$web" 2>/dev/null
wait

if [ "$stopping" = 1 ]; then
  exit 0
fi
echo "start.sh: a process exited unexpectedly; stopping the container" >&2
exit 1
