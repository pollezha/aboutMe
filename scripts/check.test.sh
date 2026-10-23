#!/usr/bin/env bash
# Тест scripts/check.sh: подставляет заведомо успешный и падающий шаги, проверяет строки и код выхода.
# Использование: bash scripts/check.test.sh
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK="$DIR/check.sh"
fails=0

assert() { # assert <описание> <условие-команда...>
  local desc="$1"
  shift
  if "$@"; then
    echo "ok   $desc"
  else
    echo "FAIL $desc"
    fails=$((fails + 1))
  fi
}

run_group() { # run_group <шаги...>: каждый шаг "имя=команда"; печатает вывод, код в $code
  out="$(
    # shellcheck source=check.sh
    source "$CHECK"
    for s in "$@"; do run_step "${s%%=*}" "${s#*=}"; done
    finish
  )"
  code=$?
}

# 1. Все шаги успешны → код 0, строки «ok   <имя> (Ns)», итог.
run_group "good=true" "also-good=echo noisy-output"
assert "успешная группа: код 0" test "$code" -eq 0
assert "успешный шаг: строка ok с временем" grep -Eq '^ok   good \([0-9]+s\)$' <<<"$out"
assert "вывод успешного шага скрыт" bash -c '! grep -q noisy-output <<<"$1"' _ "$out"
assert "итог 2 ok, 0 failed" grep -qx '2 ok, 0 failed' <<<"$out"

# 2. Падающий шаг не останавливает группу; хвост вывода ограничен CHECK_TAIL.
export CHECK_TAIL=2
run_group "bad=printf 'l1\nl2\nl3\n'; exit 3" "after=true"
assert "группа с падением: код 1" test "$code" -eq 1
assert "строка FAIL bad" grep -Eq '^FAIL bad( |$)' <<<"$out"
assert "хвост: последние 2 строки" bash -c 'grep -q l2 <<<"$1" && grep -q l3 <<<"$1" && ! grep -q l1 <<<"$1"' _ "$out"
assert "шаг после падения выполнен" grep -Eq '^ok   after \([0-9]+s\)$' <<<"$out"
assert "итог 1 ok, 1 failed" grep -qx '1 ok, 1 failed' <<<"$out"
unset CHECK_TAIL

# 3. Неизвестная группа → код 2.
bash "$CHECK" nope >/dev/null 2>&1
code=$?
assert "неизвестная группа: код 2" test "$code" -eq 2

if [ "$fails" -ne 0 ]; then
  echo "$fails assertion(s) failed"
  exit 1
fi
echo "all assertions passed"
