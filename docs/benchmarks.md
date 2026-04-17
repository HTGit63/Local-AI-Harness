# Benchmarks

Run benchmarks from built CLI:

```bash
npm run build
node apps/cli/dist/cli.js benchmark
```

The benchmark runner targets `http://127.0.0.1:3001/api` by default. Use built API/CLI for timings; Vite dev noise and sandboxed port-binding results are not the baseline.

## Matrix

Each row runs twice. First pass is cold. Second pass is warm. Report first-token timing, full-response timing, status count, and execution-loop count.

| Scenario | Route | Flags | What it checks | Target |
|---|---|---|---|---|
| Direct chat | `/api/chat/stream` | `agentic=false`, `thinking=false` | Plain turn baseline | first token < 2000ms, full < 5000ms |
| Agentic chat | `/api/chat/stream` | `agentic=true`, `thinking=false` | Planner and trace overhead | separate from direct path |
| Tool call | `/api/chat/stream` | `agentic=true`, workspace-file prompt | Native tool loop | tool loop < 15ms |
| Image turn | `/api/chat/stream` | `agentic=false`, `images=[...]` | Multimodal path | image survives end-to-end |
| Think on | `/api/chat/stream` | `agentic=false`, `thinking=true` | Provider thinking stream | reasoning visible separately |

Direct chat is the think-off baseline. Think on repeats the same short prompt with reasoning enabled.

## Support Metrics

| Metric | Target | Notes |
|---|---|---|
| File write latency | < 5ms | Local disk I/O |
| File read latency | < 5ms | Local disk I/O |
| Write-preview latency | < 5ms | Diff generation |
| Tool-loop event overhead | < 15ms | TraceBus fan-out sanity |
| UI event lag | < 2ms | TraceBus event propagation |

## Hardware Context

All benchmarks assume:
- CPU-only inference
- 16 GB RAM
- Linux x86_64
- Ollama with `gemma4:e4b`
