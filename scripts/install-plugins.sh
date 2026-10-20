#!/usr/bin/env bash
# Ставит плагины Claude Code для проекта (scope project → .claude/settings.json).
# Использование: bash scripts/install-plugins.sh [путь к claude]
set -uo pipefail

CLAUDE="${1:-${CLAUDE_BIN:-claude}}"
MARKET="claude-plugins-official"
PLUGINS=(
  csharp-lsp
  typescript-lsp
  context7
  playwright
  github
  streaming-skills-plugin
  frontend-design
  figma
  # grafana-mcp  # этап 4 (мониторинг)
)

# Языковые серверы для csharp-lsp и typescript-lsp
command -v csharp-ls >/dev/null || dotnet tool install --global csharp-ls
command -v typescript-language-server >/dev/null || npm install -g typescript-language-server typescript

"$CLAUDE" plugin marketplace update "$MARKET" || echo "warn: не удалось обновить маркетплейс"

failed=()
for p in "${PLUGINS[@]}"; do
  echo "==> $p"
  "$CLAUDE" plugin install "$p@$MARKET" --scope project || failed+=("$p")
done

if ((${#failed[@]})); then
  echo "Не установились: ${failed[*]}" >&2
  exit 1
fi
echo "Все плагины установлены."
