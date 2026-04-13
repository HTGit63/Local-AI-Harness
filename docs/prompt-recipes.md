# Prompt Recipe Library

This library curates specific, localized, and contextually-narrow prompts tuned for the `gemma4:e4b` local model. Based on patterns from the `Prompt-Engineering-Guide`, these instructions avoid verbose abstractions to maintain low-latency inference on CPUs. 

## 1. Zero-Shot Instruction
**Use**: General commands where context is passed inline.
**Format**:
```
Objective: [Task]
Context: [Minimal context]
Limit: [Strict output constraint, e.g. 'Return only JSON']
```

## 2. Few-Shot Examples (Code Patching)
**Use**: Teaching the model strict diff or edit formats.
**Format**:
```
User: Replace 'let' with 'const'.
Existing: let a = 5;
Edit: const a = 5;

User: [Current instruction]
Existing: [Target code]
Edit: [? ]
```

## 3. ReAct / Tool Prompting
**Use**: When giving the model tools `read_file` or `run_command`.
**Policy**: Ask the model to formulate ONE step.
**Format**:
```
You have tools: [tools_list]
Task: [Goal]
Phase: Thinking / Action

Think: What is the exact ONE next tool to use?
Call: [Tool_Name(args...)]
Do NOT give explanation. Halt generated text immediately after the Call block.
```

## 4. Evaluation and Self-Check
**Use**: Verifying code generation before commit.
**Format**:
```
Check the output below for syntax errors, unresolved references, and adherence to objective.
Output: [Code]
Return OK, or REJECT(reason).
```

## 5. File Synthesis & Summarization
**Use**: Broad file read overviews.
**Format**:
```
Summarize the purpose of this file in max 2 sentences. Highlight exported classes/functions and their dependencies.
```

## 6. Code Review
**Use**: Inspecting git diffs.
**Format**:
```
Review the following unified diff snippet. Focus ONLY on logic flaws and potential security bugs. Ignore stylistic nitpicks. Keep response under 3 lines.
```
