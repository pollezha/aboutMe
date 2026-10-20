#!/usr/bin/env bash
# PreToolUse hook: не даёт агенту редактировать секреты, lock-файлы и CI без спроса.
# Получает JSON вызова инструмента в stdin. Exit 2 = заблокировать (stderr уходит агенту).
# JSON разбирается через jq, если он установлен, иначе через node или python.
# Пути Windows (C:\...) нормализуются к прямым слэшам перед проверкой.
# Отредактируй список PROTECTED под свой проект.

set -uo pipefail

input="$(cat)"

extract_path() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // .tool_input.notebook_path // empty'
  elif command -v node >/dev/null 2>&1; then
    printf '%s' "$input" | node -e '
      let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
        try { const t = JSON.parse(s).tool_input || {};
              process.stdout.write(t.file_path || t.path || t.notebook_path || ""); } catch (e) {}
      });'
  elif command -v python >/dev/null 2>&1; then
    printf '%s' "$input" | python -c '
import json, sys
try:
    t = json.load(sys.stdin).get("tool_input", {}) or {}
    sys.stdout.write(t.get("file_path") or t.get("path") or t.get("notebook_path") or "")
except Exception:
    pass'
  else
    echo "guard-protected-files: нет jq/node/python — проверка пропущена." >&2
  fi
}

path="$(extract_path)"
[ -z "$path" ] && exit 0
path="$(printf '%s' "$path" | tr '\\' '/')"

PROTECTED=(
  '(^|/)\.env($|\.)'
  '(^|/)secrets/'
  '\.(pem|key|pfx)$'
  '(^|/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|packages\.lock\.json)$'
  '(^|/)\.github/workflows/'
)

for re in "${PROTECTED[@]}"; do
  if printf '%s' "$path" | grep -Eiq "$re"; then
    echo "Файл '$path' защищён (секреты / lock-файлы / CI). Спроси пользователя, прежде чем менять его, или попроси выполнить изменение вручную." >&2
    exit 2
  fi
done

exit 0
