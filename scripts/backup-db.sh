#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_PATH="${DATABASE_PATH:-$ROOT_DIR/data/flightgram.db}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"

mkdir -p "$BACKUP_DIR"
cp "$DATABASE_PATH" "$BACKUP_DIR/flightgram-$TIMESTAMP.db"

echo "Backup created at $BACKUP_DIR/flightgram-$TIMESTAMP.db"
