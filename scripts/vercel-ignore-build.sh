#!/usr/bin/env sh
# Vercel: exit 0 = skip this deployment, exit 1 = run build.
set -eu

REF="${VERCEL_GIT_COMMIT_REF:-}"
case "$REF" in
  develop|development|dev|staging) exit 0 ;;
esac

PREV="${VERCEL_GIT_PREVIOUS_SHA:-}"
CURR="${VERCEL_GIT_COMMIT_SHA:-}"
if [ -n "$PREV" ] && [ -n "$CURR" ]; then
  FILES=$(git diff --name-only "$PREV" "$CURR" 2>/dev/null || true)
  if [ -n "$FILES" ]; then
    NON_DOC=$(printf '%s\n' "$FILES" | grep -vE '^(README\.md|readme\.md|LICENSE|LICENSE\.md)$' | grep -vE '\.txt$' || true)
    if [ -z "$NON_DOC" ]; then
      exit 0
    fi
  fi
fi

exit 1
