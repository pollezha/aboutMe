// Тесты хука: node .claude/hooks/guard-protected-files.test.js
'use strict'
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { check } = require('./guard-protected-files.js')

const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } })
const ps = (command) => ({ tool_name: 'PowerShell', tool_input: { command } })
const edit = (file_path) => ({ tool_name: 'Edit', tool_input: { file_path } })

const blocked = [
  edit('C:\\x\\.env'),
  edit('.github/workflows/ci.yml'),
  edit('frontend/package-lock.json'),
  bash('cp "$SP/ci.yml" .github/workflows/ci.yml'),
  bash('sed -i "s/a/b/" frontend/package-lock.json'),
  bash('sed -i.bak "s/a/b/" .env'),
  bash('echo x > .env'),
  bash('echo x >.env.local'),
  bash('echo "API_KEY=x" >> .env'),
  bash('echo x >> .github/workflows/ci.yml'),
  bash('echo x 2> .env'),
  bash('cat .env'),
  bash('cat < .env'),
  bash('grep DB .env'),
  bash('cat ./secrets/key.json'),
  bash('rm -f frontend/package-lock.json'),
  bash('tee .github/workflows/ci.yml <<EOF\nname: x\nEOF'),
  bash('cd x && cat .env | grep TOKEN'),
  bash('cp .env.example .env'),
  ps('Set-Content -Path .github\\workflows\\ci.yml -Value $x'),
  ps('"x" >> .env'),
  ps('Get-Content .env.local'),
  ps('Select-String -Path .env -Pattern DB'),
  ps('Remove-Item -Recurse .github/workflows'),
  ps('Out-File -FilePath .env -InputObject $x'),
]

const allowed = [
  bash('npm install --save-dev ajv'),
  bash('npm ci'),
  bash('git add frontend/package-lock.json && git commit -m x'),
  bash('git commit -m "fix: hook; rm package-lock.json is now blocked"'),
  bash('git commit -m "docs: list cp|rm|tee .github/workflows/ci.yml"'),
  bash('git diff --stat 8954f12..HEAD -- . ":!frontend/package-lock.json"'),
  bash('git rm --cached .env'),
  bash('cat .github/workflows/ci.yml'),
  bash('ls -la .github/workflows/'),
  bash('grep -n aspire .github/workflows/ci.yml'),
  bash('dotnet test 2>&1 | tail -5'),
  bash('dotnet restore'),
  bash('cp src/a.cs src/b.cs'),
  bash('cat frontend/.env.example'),
  bash('echo "export const env = 1" > src/env.ts'),
  bash('echo x > /dev/null'),
  bash('cmp .github/workflows/ci.yml "$SP/ci.yml"'),
  bash('sed -n 1,5p frontend/package-lock.json'),
  bash('head -c 100 frontend/package-lock.json'),
  bash("cat > notes.txt <<'X'\ncat .env; rm .env\nX"),
  bash('cat src/ServiceDefaults/Extensions.cs'),
  edit('frontend/package.json'),
  edit('frontend/.env.example'),
  { tool_name: 'Read', tool_input: { file_path: 'README.md' } },
]

for (const call of blocked) {
  test(`blocks: [${call.tool_name}] ${JSON.stringify(call.tool_input)}`, () => {
    assert.ok(check(call), 'expected a violation')
  })
}
for (const call of allowed) {
  test(`allows: [${call.tool_name}] ${JSON.stringify(call.tool_input)}`, () => {
    assert.equal(check(call), null)
  })
}
