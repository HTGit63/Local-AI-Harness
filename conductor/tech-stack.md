# Tech Stack

- TypeScript
- Node.js HTTP API
- React + Vite web app
- local file-backed sessions and logs under `.gamma-harness`
- Ollama default runtime via OpenAI-compatible `/v1`
- optional llama.cpp/OpenAI-compatible runtime
- tests run with `tsx`

Quality gates:

- `npm run build:packages`
- `npm run build:apps`
- `npm run build`
- `npm test`
- `npm run build --workspace web`
- `npm run lint --workspace web`
- opt-in `npm run test:real-model`
