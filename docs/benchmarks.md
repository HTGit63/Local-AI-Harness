# Benchmarks

## Baseline Metrics

Run benchmarks with:
```bash
node apps/cli/dist/cli.js benchmark
```

Or programmatically:
```typescript
import { runBenchmarks } from '@local-harness/doctor';
await runBenchmarks();
```

## Measured Dimensions

| Metric | Target | Notes |
|---|---|---|
| Cold prompt latency | < 5000ms | First inference after model load |
| Warm prompt latency | < 2000ms | Subsequent inferences |
| Tool-call loop overhead | < 15ms | Engine dispatch time |
| File read latency | < 5ms | Local disk I/O |
| Write-preview latency | < 5ms | Diff generation |
| UI event lag | < 2ms | TraceBus event propagation |

## Hardware Context

All benchmarks are baselined on:
- CPU-only inference (no GPU)
- 16GB RAM
- Linux x86_64
- Ollama with `gemma4:e4b`
