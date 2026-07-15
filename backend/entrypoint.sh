#!/bin/sh
set -e

echo "Starting HabitCraft backend..."

# Migrations are handled by dbmate (see db-migrate service in docker-compose)
# This entrypoint just starts the server

exec node server.js
