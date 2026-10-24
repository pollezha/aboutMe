#!/usr/bin/env bash
# Тихий прогон проверок: на шаг одна строка «ok   <имя> (Ns)» или «FAIL <имя>» + хвост вывода.
# Использование: bash scripts/check.sh [dotnet|frontend|hook|all]   (по умолчанию all)
# CHECK_TAIL — сколько последних строк вывода показать при падении (по умолчанию 40).
# Код выхода: 0 — всё ok, 1 — есть падения, 2 — неизвестная группа.
# Тест: bash scripts/check.test.sh
set -uo pipefail

CHECK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
check_ok=0
check_failed=0

# run_step <имя> <команда>: команда выполняется в bash из корня репозитория, вывод — во временный файл.
run_step() {
  local name="$1" cmd="$2" log start rc
  log="$(mktemp)"
  start=$SECONDS
  (cd "$CHECK_ROOT" && bash -c "$cmd") >"$log" 2>&1
  rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "ok   $name ($((SECONDS - start))s)"
    check_ok=$((check_ok + 1))
  else
    echo "FAIL $name (exit $rc, $((SECONDS - start))s)"
    tail -n "${CHECK_TAIL:-40}" "$log" | sed 's/^/     /'
    check_failed=$((check_failed + 1))
  fi
  rm -f "$log"
}

# finish: итоговая строка и код выхода.
finish() {
  echo "$check_ok ok, $check_failed failed"
  [ "$check_failed" -eq 0 ]
}

group_dotnet() {
  run_step "dotnet build" "dotnet build -v q -nologo"
  run_step "dotnet test" "dotnet test --no-build --no-progress --no-ansi --max-parallel-test-modules 2"
  run_step "dotnet format" "dotnet format --verify-no-changes"
}

group_frontend() {
  local s
  for s in lint format:check typecheck test build; do
    run_step "frontend $s" "cd frontend && npm run $s"
  done
}

group_hook() {
  run_step "hook tests" "node --test .claude/hooks/guard-protected-files.test.js"
}

main() {
  case "${1:-all}" in
    dotnet) group_dotnet ;;
    frontend) group_frontend ;;
    hook) group_hook ;;
    all)
      group_dotnet
      group_frontend
      group_hook
      ;;
    *)
      echo "usage: bash scripts/check.sh [dotnet|frontend|hook|all]" >&2
      return 2
      ;;
  esac
  finish
}

# При подключении через source (тест) — только функции, без запуска.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
  exit $?
fi
