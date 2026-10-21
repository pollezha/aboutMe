#!/usr/bin/env bash
# PreToolUse hook: не даёт агенту редактировать секреты, lock-файлы и CI без спроса.
# Получает JSON вызова инструмента в stdin. Exit 2 = заблокировать (stderr уходит агенту).
# Edit/Write/NotebookEdit: проверяется путь файла.
# Bash/PowerShell: проверяется текст команды — запись/правка/удаление защищённого пути
# или чтение секретов (.env*, secrets/, ключи). Легитимные npm/dotnet/git проходят.
# Логика — в guard-protected-files.js (node); без node проверка пропускается с предупреждением.

set -uo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "guard-protected-files: нет node — проверка пропущена." >&2
  exit 0
fi

node "$(dirname "${BASH_SOURCE[0]}")/guard-protected-files.js"
