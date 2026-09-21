#!/bin/bash
#
# Daily encrypted backup of the nuruzzaman.com.bd database.
#
# Lives on the server at ~/bin/nb-db-backup.sh and runs from cron. This copy is
# here so the thing that protects the data is reviewable and has a history.
#
# What it does, in order:
#   1. dumps one database - this account also holds other sites' databases, and
#      they are not this site's to copy;
#   2. compresses and encrypts it with a key that never leaves the server
#      unless the owner copies it somewhere safe;
#   3. proves the result decrypts, unpacks, and ends with mysqldump's own
#      "Dump completed" line, with the expected number of tables;
#   4. keeps fourteen days and deletes what is older;
#   5. writes what happened to a log, and says nothing on success - cron mails
#      the account only when something is written to stderr, which is how a
#      failure reaches a person.
#
# Restoring is in docs/BACKUP_RESTORE_BN.md. Without the key the backups are
# unreadable, including by whoever ends up with the server.

set -uo pipefail

DATABASE='nbconsultant_nuruzzaman'
ENV_FILE="$HOME/api.nuruzzaman.com.bd/.env"
BACKUP_DIR="$HOME/nb-db-backups"
KEY_FILE="$HOME/.nb-backup.key"
LOG_FILE="$HOME/logs/nb-db-backup.log"
KEEP_DAYS=14
MIN_TABLES=80

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/nuruzzaman-$timestamp.sql.gz.enc"
work=""

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$LOG_FILE"
}

fail() {
  log "FAILED: $*"
  # stderr, so cron mails the account owner. Nothing is written on success.
  printf 'nuruzzaman.com.bd database backup FAILED: %s\n' "$*" >&2
  [ -n "$work" ] && rm -rf "$work"
  exit 1
}

umask 077
mkdir -p "$BACKUP_DIR" "$(dirname "$LOG_FILE")" || fail 'could not create the backup directory'
chmod 700 "$BACKUP_DIR"

[ -r "$ENV_FILE" ] || fail "cannot read $ENV_FILE"
[ -r "$KEY_FILE" ] || fail "no encryption key at $KEY_FILE"

# Credentials come from the application's own .env and are passed through an
# option file, never on the command line where `ps` would show them.
db_user="$(sed -n 's/^DB_USERNAME=//p' "$ENV_FILE" | head -1 | tr -d '"'"'"'\r')"
db_pass="$(sed -n 's/^DB_PASSWORD=//p' "$ENV_FILE" | head -1 | tr -d '"'"'"'\r')"
db_host="$(sed -n 's/^DB_HOST=//p' "$ENV_FILE" | head -1 | tr -d '"'"'"'\r')"
[ -n "$db_user" ] && [ -n "$db_pass" ] || fail 'no database credentials in .env'

work="$(mktemp -d "$BACKUP_DIR/.tmp-XXXXXX")" || fail 'could not create a working directory'
option_file="$work/my.cnf"
printf '[client]\nuser=%s\npassword=%s\nhost=%s\n' "$db_user" "$db_pass" "${db_host:-localhost}" > "$option_file"
chmod 600 "$option_file"

# --single-transaction so the site keeps serving while this runs.
#
# --no-tablespaces because a cPanel database user has no PROCESS privilege:
# without it mysqldump writes a warning on every run, and a daily warning is
# how a real failure ends up unread.
mysqldump --defaults-extra-file="$option_file" \
  --single-transaction --quick --routines --triggers --events --no-tablespaces \
  --default-character-set=utf8mb4 "$DATABASE" \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$KEY_FILE" \
  > "$work/backup.enc"

status=("${PIPESTATUS[@]}")
[ "${status[0]}" -eq 0 ] || fail "mysqldump exited ${status[0]}"
[ "${status[1]}" -eq 0 ] || fail "gzip exited ${status[1]}"
[ "${status[2]}" -eq 0 ] || fail "openssl exited ${status[2]}"

# A backup nobody has opened is a hope, not a backup: this one is opened here.
plain="$work/check.sql"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$KEY_FILE" -in "$work/backup.enc" \
  | gunzip > "$plain" || fail 'the backup did not decrypt and unpack'

tail -1 "$plain" | grep -q 'Dump completed' || fail 'the dump is truncated (no "Dump completed" line)'
tables="$(grep -c '^CREATE TABLE' "$plain")"
[ "$tables" -ge "$MIN_TABLES" ] || fail "only $tables tables in the dump, expected at least $MIN_TABLES"

mv "$work/backup.enc" "$target" || fail 'could not move the backup into place'
chmod 600 "$target"
rm -rf "$work"
work=""

removed="$(find "$BACKUP_DIR" -maxdepth 1 -name 'nuruzzaman-*.sql.gz.enc' -type f -mtime "+$KEEP_DAYS" -print -delete | wc -l)"
date -u +%Y-%m-%dT%H:%M:%SZ > "$BACKUP_DIR/last-success"
chmod 600 "$BACKUP_DIR/last-success"

log "ok $(basename "$target") $(stat -c %s "$target") bytes, $tables tables, $removed older backup(s) removed"
exit 0
