#!/bin/sh
# Runs a dev command inside a container and restarts it whenever the installed npm packages
# change. The `deps` service removes node_modules/.lock-hash before reinstalling and writes it
# back when done, so a running server never keeps going on half-deleted packages.
#
# Usage: supervise.sh <command> [args...]

marker=/app/node_modules/.lock-hash
installed() { cat "$marker" 2>/dev/null; }
wanted() { sha1sum /app/package-lock.json | cut -d' ' -f1; }

pid=''
trap 'if [ -n "$pid" ]; then kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null; fi; exit 0' TERM INT

while true; do
  if [ "$(installed)" != "$(wanted)" ]; then
    echo "Waiting for npm packages to finish installing..."
    while [ "$(installed)" != "$(wanted)" ]; do sleep 1; done
  fi
  running_with=$(installed)

  "$@" &
  pid=$!

  while kill -0 "$pid" 2>/dev/null && [ "$(installed)" = "$running_with" ]; do sleep 2; done

  if kill -0 "$pid" 2>/dev/null; then
    echo "npm packages changed. Restarting..."
    kill "$pid" 2>/dev/null
    wait "$pid" 2>/dev/null
  else
    wait "$pid"
    echo "Stopped with exit code $?. Restarting in 3 seconds..."
    sleep 3
  fi
  pid=''
done
