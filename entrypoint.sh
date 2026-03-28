#!/bin/sh
# NetWatch Dashboard entrypoint
# Initializes the database from template on first run

if [ ! -f data.db ]; then
  echo "Initializing database from template..."
  cp data.db.template data.db
fi

exec node dist/index.cjs
