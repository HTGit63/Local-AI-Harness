// Mock Ollama model responses for offline test runs
export const MOCK_CHAT_RESPONSE = {
  id: 'mock-1',
  object: 'chat.completion',
  choices: [{
    index: 0,
    message: { role: 'assistant', content: 'This is a mocked model response for testing.' },
    finish_reason: 'stop'
  }],
  usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 }
};

export const MOCK_MODEL_LIST = {
  object: 'list',
  data: [
    { id: 'deepseek-coder-v2:latest', object: 'model', owned_by: 'local' },
    { id: 'qwen3.5:9b-q4_K_M', object: 'model', owned_by: 'local' },
    { id: 'gemma4:e4b', object: 'model', owned_by: 'local' },
    { id: 'VladimirGav/gemma4-26b-16GB-VRAM:latest', object: 'model', owned_by: 'local' },
  ]
};

export const MOCK_HEALTH = { status: 'ok' };
export const MOCK_MODEL_CAPABILITIES: Record<string, string[]> = {
  'gemma4:e4b': ['completion', 'vision', 'audio', 'tools', 'thinking'],
  'qwen3.5:9b-q4_K_M': ['completion', 'vision', 'tools', 'thinking'],
  'deepseek-coder-v2:latest': ['completion', 'insert'],
  'VladimirGav/gemma4-26b-16GB-VRAM:latest': ['completion', 'vision', 'tools', 'thinking'],
};

interface MockFetchOptions {
  chatResponder?: (body: any) => any;
  onChatRequest?: (body: any) => void;
  showResponder?: (body: any) => any;
  initialRunningModels?: Array<{ name: string; model: string; context_length: number }>;
}

function encodeStreamChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function createStreamingChatBody(response: typeof MOCK_CHAT_RESPONSE): ReadableStream<Uint8Array> {
  const content = response.choices[0]?.message?.content || '';
  const midpoint = Math.max(1, Math.floor(content.length / 2));
  const parts = [content.slice(0, midpoint), content.slice(midpoint)].filter(Boolean);
  const chunks = parts.map((part) => `data: ${JSON.stringify({
    id: response.id,
    object: 'chat.completion.chunk',
    choices: [{
      index: 0,
      delta: { role: 'assistant', content: part },
      finish_reason: null,
    }],
  })}\n\n`);
  chunks.push(`data: ${JSON.stringify({
    id: response.id,
    object: 'chat.completion.chunk',
    choices: [{
      index: 0,
      delta: {},
      finish_reason: 'stop',
    }],
  })}\n\n`);
  chunks.push('data: [DONE]\n\n');
  return encodeStreamChunks(chunks);
}

function splitThinkingBlocks(content: string): { thinking: string; content: string } {
  const thinking = Array.from(content.matchAll(/<think>([\s\S]*?)<\/think>/gi))
    .map((match) => match[1]?.trim() || '')
    .filter(Boolean)
    .join('\n\n');
  return {
    thinking,
    content: content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim(),
  };
}

function toNativeChatResponse(response: typeof MOCK_CHAT_RESPONSE) {
  const message = (response.choices[0]?.message || { role: 'assistant', content: '' }) as {
    role: string;
    content: string;
    thinking?: string;
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: string | Record<string, unknown>;
      };
    }>;
  };
  const combinedContent = typeof message.content === 'string' ? message.content : '';
  const split = splitThinkingBlocks(combinedContent);

  return {
    model: 'mock-native',
    message: {
      role: message.role,
      content: split.content,
      thinking: split.thinking || (typeof message.thinking === 'string' ? message.thinking : ''),
      tool_calls: Array.isArray(message.tool_calls)
        ? message.tool_calls.map((toolCall) => ({
            function: {
              name: toolCall.function.name,
              arguments: typeof toolCall.function.arguments === 'string'
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments,
            },
          }))
        : undefined,
    },
    done: true,
    done_reason: response.choices[0]?.finish_reason || 'stop',
    prompt_eval_count: response.usage?.prompt_tokens || 0,
    eval_count: response.usage?.completion_tokens || 0,
  };
}

function createNativeStreamingChatBody(response: typeof MOCK_CHAT_RESPONSE): ReadableStream<Uint8Array> {
  const native = toNativeChatResponse(response);
  const chunks: string[] = [];

  if (native.message.thinking) {
    chunks.push(`${JSON.stringify({
      model: native.model,
      message: {
        role: native.message.role,
        thinking: native.message.thinking,
      },
      done: false,
    })}\n`);
  }

  if (native.message.content) {
    chunks.push(`${JSON.stringify({
      model: native.model,
      message: {
        role: native.message.role,
        content: native.message.content,
      },
      done: false,
    })}\n`);
  }

  if (native.message.tool_calls) {
    chunks.push(`${JSON.stringify({
      model: native.model,
      message: {
        role: native.message.role,
        tool_calls: native.message.tool_calls,
      },
      done: false,
    })}\n`);
  }

  chunks.push(`${JSON.stringify({
    model: native.model,
    message: {},
    done: true,
    done_reason: native.done_reason,
    prompt_eval_count: native.prompt_eval_count,
    eval_count: native.eval_count,
  })}\n`);

  return encodeStreamChunks(chunks);
}

export function createMockFetch(options: MockFetchOptions = {}) {
  let runningModels: Array<{ name: string; model: string; context_length: number }> = [...(options.initialRunningModels || [])];

  return async (url: string, opts?: any) => {
    const rawBody = typeof opts?.body === 'string' ? opts.body : '';
    const body = rawBody ? JSON.parse(rawBody) : {};

    if (url.includes('/api/chat')) {
      options.onChatRequest?.(body);
      const responsePayload = options.chatResponder ? options.chatResponder(body) : MOCK_CHAT_RESPONSE;
      if (body.stream) {
        return {
          ok: true,
          body: createNativeStreamingChatBody(responsePayload),
          status: 200,
        } as any;
      }
      return {
        ok: true,
        json: async () => toNativeChatResponse(responsePayload),
        status: 200,
      } as any;
    }

    if (url.includes('/v1/chat/completions')) {
      options.onChatRequest?.(body);
      const responsePayload = options.chatResponder ? options.chatResponder(body) : MOCK_CHAT_RESPONSE;
      if (body.stream) {
        return {
          ok: true,
          body: createStreamingChatBody(responsePayload),
          status: 200,
        } as any;
      }
      return {
        ok: true,
        json: async () => responsePayload,
        status: 200,
      } as any;
    }
    if (url.includes('/v1/models')) {
      return { ok: true, json: async () => MOCK_MODEL_LIST, status: 200 } as any;
    }
    if (url.includes('/api/tags')) {
      return {
        ok: true,
        json: async () => ({
          models: MOCK_MODEL_LIST.data.map((entry) => ({ name: entry.id })),
        }),
        status: 200,
      } as any;
    }
    if (url.includes('/api/ps')) {
      return {
        ok: true,
        json: async () => ({ models: runningModels }),
        status: 200,
      } as any;
    }
    if (url.includes('/api/generate')) {
      const model = body.model;
      if (body.keep_alive === 0) {
        runningModels = runningModels.filter((entry) => entry.model !== model);
        return {
          ok: true,
          json: async () => ({ model, done: true, done_reason: 'unload', response: '' }),
          status: 200,
        } as any;
      }

      runningModels = [{ name: model, model, context_length: 4096 }];
      return {
        ok: true,
        json: async () => ({ model, done: true, done_reason: 'load', response: '' }),
        status: 200,
      } as any;
    }
    if (url.includes('/api/show')) {
      const modelName = body.name || body.model;
      const responsePayload = options.showResponder
        ? options.showResponder(body)
        : { capabilities: MOCK_MODEL_CAPABILITIES[modelName] || ['completion'] };
      return {
        ok: true,
        json: async () => responsePayload,
        status: 200,
      } as any;
    }
    return { ok: true, json: async () => MOCK_HEALTH, status: 200 } as any;
  };
}
