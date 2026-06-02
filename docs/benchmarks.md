# Benchmarks

Run benchmarks from built API/CLI:

```bash
npm run build
node apps/cli/dist/cli.js benchmark
```

The benchmark runner targets `http://127.0.0.1:3001/api` by default. Use built code for baseline timings.

## Matrix

| Scenario | Route | What it checks |
|---|---|---|
| Direct chat | `/api/chat/stream` | Plain model turn and first-token timing |
| Agent chat | `/api/chat/stream` | Planner and trace overhead |
| Tool call | `/api/chat/stream` | Bounded tool loop |
| Image turn | `/api/chat/stream` | Multimodal payload survives API/runtime |
| Think on | `/api/chat/stream` | Provider-emitted thinking is separated when returned |
| Deterministic list/read/search/git | `/api/workspace/*` | Zero model calls and immediate tool timing |

## Targets

| Metric | Target |
|---|---:|
| List root folder | < 200 ms |
| Read normal file | < 100 ms |
| Git status | < 500 ms |
| Search normal repo | < 2 sec |
| Deterministic model calls | 0 |
| Tool event overhead | < 15 ms |

## Hardware Context

Baseline assumes local Linux, 16 GB RAM, CPU-first inference, `llama.cpp`, and Gemma 4 E4B.
