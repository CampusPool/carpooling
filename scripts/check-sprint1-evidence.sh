#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
plan="$root/docs/SPRINT1_TEST_PLAN.md"
results="$root/docs/SPRINT1_TEST_RESULTS.md"

test -s "$plan"
test -s "$results"
for case_id in REG-01 BOOK-01 CAP-01 CANCEL-01 AUTH-01 WEB-01 PROJ-01; do
  grep -Fq "| $case_id |" "$plan"
done
grep -Fq 'Source revision under test:' "$results"
grep -Fq 'Database:' "$results"
grep -Fq 'not verified' "$results"
grep -Fq 'PASS' "$results"

if grep -Eiq '(AIza[0-9A-Za-z_-]{20,}|password[[:space:]]*[:=]|secret[[:space:]]*[:=])' "$plan" "$results"; then
  echo 'credential-like text found in Sprint 1 evidence' >&2
  exit 1
fi

printf '%s\n' 'Sprint 1 traceability matrix and evidence record are complete; pending criteria remain explicit.'
