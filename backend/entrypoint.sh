#!/bin/bash
set -e

echo "Starting backend entrypoint..."

# Ensure data directory exists
mkdir -p /app/data

# Run the seed script to populate the database if it's empty
echo "Checking database and seeding if necessary..."
python -m seed

# Execute the main command (from Dockerfile CMD)
echo "Starting the application..."
exec "$@"
