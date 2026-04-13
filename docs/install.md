# Install Guide

## Prerequisites

- **Node.js** ≥ 18
- **Ollama** installed and running
- **Gemma 4 E4B** model pulled

## Step 1: Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

## Step 2: Pull the model

```bash
ollama pull gemma4:e4b
```

Verify it's running:
```bash
curl http://127.0.0.1:11434/api/tags
```

## Step 3: Clone and install

```bash
git clone <repo-url> gamma-harness
cd gamma-harness
npm install
```

## Step 4: Build the workspace

```bash
npm run build
```

## Step 5: Run doctor

```bash
node apps/cli/dist/cli.js doctor
```

All checks should show ✅.

## Step 6: Launch

**Web UI:**
```bash
# terminal 1
npm run dev --workspace @local-harness/api

# terminal 2
npm run dev --workspace web
```
Open `http://localhost:5173`

**CLI:**
```bash
node apps/cli/dist/cli.js chat
```
