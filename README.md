# aboutMe

Portfolio site of Yakov Polezhaev, .NET backend developer. An isometric island city where every building is
a chapter of the CV. The site is also the proof of skills: it runs on its own .NET services, Kafka, SignalR
and a full OpenTelemetry stack, and the monitoring is public.

> Status: stage 1 of 8 (foundation). The roadmap is in [docs/plans/roadmap.md](docs/plans/roadmap.md).

## Architecture

```
browser ─► Cloudflare Pages (Vue 3 + TresJS, prerendered, content snapshot)
   │
   └─► Caddy ─► gateway (YARP) ─┬─► content-api ─► PostgreSQL
                                ├─► events-api ─► Kafka site.events.v1 ─┬─► projector ─► PostgreSQL
                                │                                       └─► live-hub ─► SignalR ─► browser
                                └─► live-hub (/hubs/live)
OpenTelemetry Collector ─► Prometheus · Loki · Tempo ─► Grafana ─► Telegram alerts
```

Details: [technical design](docs/design/architecture.md), decisions in [docs/adr/](docs/adr/),
requirements and acceptance tests in [the spec](docs/spec/portfolio-mvp.md).

## Run locally

Requirements: Docker, [.NET 10 SDK](https://dotnet.microsoft.com/download), Node.js 24 LTS.

One-time setup of the Aspire CLI bundle (DCP and dashboard; takes a few minutes):

```bash
dotnet dnx --yes aspire.cli@13.6.1 -- setup --install-path ~/.aspire
```

Run everything with one command:

```bash
dotnet run --project src/AppHost
```

This starts, in Docker and as local processes:

- PostgreSQL with databases `content` and `stats` (migrations are applied on start, content is seeded from `content/`);
- Kafka (KRaft) with Kafka UI; events-api creates the topic `site.events.v1` (3 partitions) on start;
- 5 services: gateway, content-api, events-api, projector, live-hub — each waits for its dependencies.

The Aspire dashboard (link in the console output, `https://localhost:17236`) shows resource state, logs,
traces and metrics. Everything is ready when all resources are Running/Healthy (about a minute; the first run
pulls the images and takes longer). The gateway — the only public entry — listens on `http://localhost:5080`:

```bash
curl http://localhost:5080/alive                 # gateway process is up
curl http://localhost:5080/health                # 200 when all 4 backends are healthy (localhost only)
curl -i http://localhost:5080/api/content/en     # content with ETag
curl -i -X POST http://localhost:5080/api/events -H "Content-Type: application/json"   -d '{"eventId":"019a1b2c-0000-7000-8000-000000000001","type":"cta_click","occurredAt":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","sessionId":"s1","lang":"en","theme":"day","payload":{"cta":"github"}}'   # 202
```

Optional: `Telegram__BotToken` / `Telegram__ChatId` for the message-in-a-bottle form (without them
`POST /api/messages` returns 503, the rest works).

Frontend only (works without the backend, on the content snapshot):

```bash
cd frontend && npm ci && npm run dev
```

## Checks

```bash
dotnet build && dotnet test && dotnet format --verify-no-changes
cd frontend && npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
```

`npm run build` validates `content/*.json` first and fails on `[ADD]` placeholders or empty links.

## Repository layout

| Path | What |
|---|---|
| `frontend/` | Vue 3 + TypeScript + Vite, tests (Vitest) |
| `services/` | Deployable .NET services: gateway, content-api, events-api, projector, live-hub |
| `src/` | Shared .NET projects: ServiceDefaults, Contracts, AppHost (Aspire) |
| `tests/` | .NET tests (xUnit v3, Aspire integration tests) |
| `content/` | Site content EN/RU as JSON + JSON Schema |
| `docs/` | Spec, design, ADRs, plans, learnings |

## Built with an AI agent

Developed with Claude Code using a spec → design → plan → TDD → verify → review process.
The agent rules live in [CLAUDE.md](CLAUDE.md), review criteria in [REVIEW.md](REVIEW.md),
the workflow in [docs/claude-workflow.md](docs/claude-workflow.md).
