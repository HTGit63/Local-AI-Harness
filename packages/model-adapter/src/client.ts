import {
  AdapterOptions,
  AvailableModel,
  ChatCompletionRequest,
  ChatMessage,
  ModelRuntimeState,
  ModelSwitchResult,
  RunningModel,
} from './types';
import { DEFAULT_CONFIG, PROFILES } from './config';

type ReasoningEffort = ChatCompletionRequest['reasoning_effort'];

function extractText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }

        if (entry && typeof entry === 'object') {
          const chunk = entry as { text?: unknown; content?: unknown; value?: unknown };
          if (typeof chunk.text === 'string') {
            return chunk.text;
          }
          if (typeof chunk.content === 'string') {
            return chunk.content;
          }
          if (typeof chunk.value === 'string') {
            return chunk.value;
          }
        }

        return '';
      })
      .join('');
  }

  if (value && typeof value === 'object') {
    const candidate = value as { text?: unknown; content?: unknown };
    if (typeof candidate.text === 'string') {
      return candidate.text;
    }
    if (typeof candidate.content === 'string') {
      return candidate.content;
    }
  }

  return '';
}

function splitThinkingBlocks(content: string): { content: string; thinking: string } {
  const thinkingMatches = Array.from(content.matchAll(/<think>([\s\S]*?)<\/think>/gi))
    .map((match) => match[1]?.trim() || '')
    .filter(Boolean);
  const contentWithoutThinking = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  return {
    content: contentWithoutThinking,
    thinking: thinkingMatches.join('\n\n'),
  };
}

function combineThinkingAndContent(thinking: string, content: string): string {
  if (thinking && content) {
    return `<think>${thinking}</think>${content}`;
  }

  if (thinking) {
    return `<think>${thinking}</think>`;
  }

  return content;
}

function mapToolCallsToOllama(toolCalls: unknown): Array<{ function: { name: string; arguments: Record<string, unknown> } }> | undefined {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return undefined;
  }

  const normalizedCalls = toolCalls
    .map((toolCall) => {
      if (!toolCall || typeof toolCall !== 'object') {
        return null;
      }

      const call = toolCall as {
        function?: {
          name?: unknown;
          arguments?: unknown;
        };
      };

      if (!call.function || typeof call.function.name !== 'string' || !call.function.name.trim()) {
        return null;
      }

      let parsedArguments: Record<string, unknown> = {};
      if (typeof call.function.arguments === 'string' && call.function.arguments.trim()) {
        try {
          const value = JSON.parse(call.function.arguments);
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            parsedArguments = value as Record<string, unknown>;
          }
        } catch {
          parsedArguments = {};
        }
      } else if (call.function.arguments && typeof call.function.arguments === 'object' && !Array.isArray(call.function.arguments)) {
        parsedArguments = call.function.arguments as Record<string, unknown>;
      }

      return {
        function: {
          name: call.function.name.trim(),
          arguments: parsedArguments,
        },
      };
    })
    .filter((entry): entry is { function: { name: string; arguments: Record<string, unknown> } } => entry !== null);

  return normalizedCalls.length > 0 ? normalizedCalls : undefined;
}

function mapToolCallsToOpenAi(toolCalls: unknown): any[] | undefined {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return undefined;
  }

  const normalizedCalls = toolCalls
    .map((toolCall, index) => {
      if (!toolCall || typeof toolCall !== 'object') {
        return null;
      }

      const call = toolCall as {
        function?: {
          name?: unknown;
          arguments?: unknown;
        };
      };

      if (!call.function || typeof call.function.name !== 'string' || !call.function.name.trim()) {
        return null;
      }

      const argumentsValue = call.function.arguments && typeof call.function.arguments === 'object' && !Array.isArray(call.function.arguments)
        ? JSON.stringify(call.function.arguments)
        : typeof call.function.arguments === 'string'
          ? call.function.arguments
          : '{}';

      return {
        id: `ollama-tool-${index + 1}`,
        type: 'function',
        function: {
          name: call.function.name.trim(),
          arguments: argumentsValue,
        },
      };
    })
    .filter((entry): entry is any => entry !== null);

  return normalizedCalls.length > 0 ? normalizedCalls : undefined;
}

function mapMessagesToOllama(messages: ChatMessage[]): Array<Record<string, unknown>> {
  return messages.map((message) => {
    const contentFromMessage = extractText(message.content);
    const embeddedThinking = splitThinkingBlocks(contentFromMessage);
    const thinking = (typeof message.thinking === 'string' && message.thinking.trim())
      ? message.thinking.trim()
      : embeddedThinking.thinking;
    const content = embeddedThinking.content;

    const mappedMessage: Record<string, unknown> = {
      role: message.role,
      content,
    };

    if (thinking) {
      mappedMessage.thinking = thinking;
    }

    if (typeof message.name === 'string' && message.name.trim()) {
      mappedMessage.name = message.name.trim();
    }

    const toolCalls = mapToolCallsToOllama(message.tool_calls);
    if (toolCalls) {
      mappedMessage.tool_calls = toolCalls;
    }

    if (typeof message.tool_call_id === 'string' && message.tool_call_id.trim()) {
      mappedMessage.tool_call_id = message.tool_call_id.trim();
    }

    // Multimodal: pass through base64 images for Gemma 4 vision support
    if (Array.isArray(message.images) && message.images.length > 0) {
      mappedMessage.images = message.images;
    }

    return mappedMessage;
  });
}

export class ModelAdapter {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private timeoutMs: number;
  private retries: number;
  private profileName: string;
  private lastSwitchResult: ModelSwitchResult | undefined;
  private readonly capabilityCache = new Map<string, string[] | null>();
  private nativeChatSupported: boolean | null = null;
  private runtimeStateCache: { value: ModelRuntimeState; expiresAt: number } | null = null;

  constructor(options: Partial<AdapterOptions> = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_CONFIG.baseUrl;
    this.apiKey = options.apiKey ?? DEFAULT_CONFIG.apiKey;
    this.model = options.model ?? DEFAULT_CONFIG.model;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_CONFIG.timeoutMs;
    this.retries = options.retries ?? DEFAULT_CONFIG.retries;
    this.profileName = options.profile ?? DEFAULT_CONFIG.profile;
  }

  updateConfig(options: Partial<AdapterOptions> = {}) {
    if (options.baseUrl !== undefined) {
      this.baseUrl = options.baseUrl;
      this.capabilityCache.clear();
      this.nativeChatSupported = null;
      this.runtimeStateCache = null;
    }
    if (options.apiKey !== undefined) {
      this.apiKey = options.apiKey;
      this.runtimeStateCache = null;
    }
    if (options.model !== undefined) {
      this.model = options.model;
      this.runtimeStateCache = null;
    }
    if (options.timeoutMs !== undefined) {
      this.timeoutMs = options.timeoutMs;
    }
    if (options.retries !== undefined) {
      this.retries = options.retries;
    }
    if (options.profile !== undefined) {
      this.profileName = options.profile;
    }
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
  }

  private get nativeBaseUrl() {
    return this.baseUrl.replace(/\/v1\/?$/, '');
  }

  private async fetchJson<T>(url: string, options: RequestInit, timeoutMs = this.timeoutMs): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal as any,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Request failed: ${response.status} ${text}`);
      }

      return await response.json() as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async supportsOllamaNativeChat(): Promise<boolean> {
    if (this.nativeChatSupported !== null) {
      return this.nativeChatSupported;
    }

    try {
      await this.fetchJson(
        `${this.nativeBaseUrl}/api/tags`,
        {
          method: 'GET',
          headers: this.headers,
        },
        10_000,
      );
      this.nativeChatSupported = true;
    } catch {
      this.nativeChatSupported = false;
    }

    return this.nativeChatSupported;
  }

  private mapReasoningEffortToOllamaThink(reasoningEffort?: ReasoningEffort): boolean | 'low' | 'medium' | 'high' | undefined {
    switch (reasoningEffort) {
      case 'none':
        return false;
      case 'low':
      case 'medium':
      case 'high':
        return reasoningEffort;
      default:
        return undefined;
    }
  }

  private buildOllamaChatBody(request: ChatCompletionRequest, profile: { temperature: number; max_tokens: number }) {
    // Explicit think toggle takes priority over reasoning_effort mapping
    const think = request.think !== undefined
      ? request.think
      : this.mapReasoningEffortToOllamaThink(request.reasoning_effort);
    const targetModel = request.model ?? this.model;
    const lowerModel = targetModel.toLowerCase();
    
    let optTemperature = request.temperature ?? profile.temperature;
    let optMaxTokens = request.max_tokens ?? profile.max_tokens;

    // Architectural parameter tuning based on AI model name
    if (lowerModel.includes('gemma')) {
      // Gemma 4 supports up to 128k context, raise the token ceiling
      optMaxTokens = Math.min(optMaxTokens, 16384);
      optTemperature = Math.max(0.01, optTemperature * 0.8);
    } else if (lowerModel.includes('deepseek')) {
      optMaxTokens = Math.max(optMaxTokens, 16384);
    } else if (lowerModel.includes('qwen')) {
      optTemperature = Math.min(1.0, optTemperature * 1.1);
    }

    const body: Record<string, unknown> = {
      model: targetModel,
      messages: mapMessagesToOllama(request.messages),
      stream: request.stream ?? false,
      options: {
        temperature: optTemperature,
        num_predict: optMaxTokens,
      },
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
    }

    if (think !== undefined) {
      body.think = think;
    }

    return body;
  }

  private normalizeOllamaChatResponse(payload: any) {
    const ollamaMessage = payload?.message ?? {};
    
    // Explicitly handle alternate reasoning tags architectures (DeepSeek reasoning_content/think mappings)
    let thinking = extractText(ollamaMessage.thinking);
    let content = extractText(ollamaMessage.content);
    
    // Qwen tool translation intercept
    if (content.includes('<|im_start|>tool') || content.includes('<tool_call>')) {
      // Stub implementation: a real implementation would parse the xml into ollamaMessage.tool_calls securely
      // This protects Qwen from spilling raw tool execution XML to UI
      content = content.replace(/<\|im_start\|>tool[\s\S]*?(<\|im_end\|>|$)/g, '').replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '');
    }

    const toolCalls = mapToolCallsToOpenAi(ollamaMessage.tool_calls);

    return {
      id: payload?.id ?? `ollama-${Date.now()}`,
      object: 'chat.completion',
      choices: [
        {
          index: 0,
          message: {
            role: typeof ollamaMessage.role === 'string' ? ollamaMessage.role : 'assistant',
            content,
            thinking,
            ...(toolCalls ? { tool_calls: toolCalls } : {}),
          },
          finish_reason: payload?.done_reason ?? 'stop',
        },
      ],
      usage: {
        prompt_tokens: payload?.prompt_eval_count ?? 0,
        completion_tokens: payload?.eval_count ?? 0,
        total_tokens: (payload?.prompt_eval_count ?? 0) + (payload?.eval_count ?? 0),
      },
    };
  }

  private wrapOllamaStreamAsOpenAi(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        let buffer = '';

        const pushChunk = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        const processLine = (line: string) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return;
          }

          const payload = JSON.parse(trimmed);
          const message = payload?.message ?? {};
          const thinking = extractText(message.thinking);
          let content = extractText(message.content);
          
          // Qwen tool translation intercept for streaming chunks
          if (content.includes('<|im_start|>tool') || content.includes('<tool_call>')) {
            content = content.replace(/<\|im_start\|>tool[\s\S]*?(<\|im_end\|>|$)/g, '').replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '');
          }
          
          const toolCalls = mapToolCallsToOpenAi(message.tool_calls);
          const delta: Record<string, unknown> = {};

          if (typeof message.role === 'string') {
            delta.role = message.role;
          }
          if (thinking) {
            delta.thinking = thinking;
          }
          if (content) {
            delta.content = content;
          }
          if (toolCalls) {
            delta.tool_calls = toolCalls.map((toolCall, index) => ({
              ...toolCall,
              index,
            }));
          }

          pushChunk({
            id: payload?.id ?? `ollama-${Date.now()}`,
            object: 'chat.completion.chunk',
            choices: [
              {
                index: 0,
                delta,
                finish_reason: payload?.done ? (payload?.done_reason ?? 'stop') : null,
              },
            ],
          });

          if (payload?.done) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              processLine(line);
            }
          }

          buffer += decoder.decode();
          if (buffer.trim()) {
            processLine(buffer);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      },
    });
  }

  private async createOllamaChatCompletion(request: ChatCompletionRequest) {
    const profile = PROFILES[this.profileName] || PROFILES['balanced'];
    const chatTimeout = Math.max(this.timeoutMs * 4, 180_000);
    const response = await this.fetchWithRetry(`${this.nativeBaseUrl}/api/chat`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(this.buildOllamaChatBody(request, profile)),
      signal: request.signal,
    }, chatTimeout);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Native Ollama chat failed: ${response.status} ${text}`);
    }

    if (request.stream) {
      return response.body ? this.wrapOllamaStreamAsOpenAi(response.body as ReadableStream<Uint8Array>) : null;
    }

    const payload = await response.json();
    return this.normalizeOllamaChatResponse(payload);
  }

  private async tryListRunningModels(): Promise<{ supportsLifecycle: boolean; models: RunningModel[] }> {
    try {
      const data = await this.fetchJson<{ models?: RunningModel[] }>(
        `${this.nativeBaseUrl}/api/ps`,
        {
          method: 'GET',
          headers: this.headers,
        },
        10_000,
      );
      return {
        supportsLifecycle: true,
        models: data.models || [],
      };
    } catch {
      return {
        supportsLifecycle: false,
        models: [],
      };
    }
  }

  private async listInstalledModels(): Promise<string[]> {
    try {
      const data = await this.fetchJson<{ models?: Array<{ name: string }> }>(
        `${this.nativeBaseUrl}/api/tags`,
        {
          method: 'GET',
          headers: this.headers,
        },
        10_000,
      );

      return (data.models || [])
        .map((entry) => entry.name)
        .filter((value): value is string => typeof value === 'string' && value.length > 0);
    } catch {
      const models = await this.listModels();
      return models
        .map((entry) => entry.id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0);
    }
  }

  private async unloadModel(modelName: string): Promise<void> {
    await this.fetchJson(
      `${this.nativeBaseUrl}/api/generate`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model: modelName,
          keep_alive: 0,
        }),
      },
      Math.max(this.timeoutMs, 30_000),
    );
  }

  private async preloadModel(modelName: string): Promise<void> {
    await this.fetchJson(
      `${this.nativeBaseUrl}/api/generate`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model: modelName,
          prompt: '',
          stream: false,
          keep_alive: '2m',
        }),
      },
      Math.max(this.timeoutMs * 4, 120_000),
    );
  }

  async isHealthy(): Promise<boolean> {
    try {
      // For Ollama / OpenAI v1 compat
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000); // 5s health check timeout
      const res = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: this.headers,
        signal: controller.signal as any
      });
      clearTimeout(id);
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<any[]> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: this.headers
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      return data.data || [];
    } catch (error) {
      console.warn("Model Adapter: Degraded mode. Returning default model as fallback.", error);
      return [{ id: this.model, object: 'model' }];
    }
  }

  async getRuntimeState(cacheTtlMs = 10_000): Promise<ModelRuntimeState> {
    const now = Date.now();
    if (cacheTtlMs > 0 && this.runtimeStateCache && this.runtimeStateCache.expiresAt > now) {
      return this.runtimeStateCache.value;
    }

    const availableModels = await this.listModels() as AvailableModel[];
    const installedModels = await this.listInstalledModels();
    const runningInfo = await this.tryListRunningModels();
    const runningModels = runningInfo.models;
    const configuredModelActive = runningModels.find((entry) => entry.model === this.model || entry.name === this.model);
    const configuredModelCapabilities = await this.getModelCapabilities(this.model);

    const runtimeState = {
      configuredModel: this.model,
      activeModel: configuredModelActive?.model || (runningModels.length === 1 ? runningModels[0].model : null),
      runningModels,
      installedModels,
      availableModels,
      supportsLifecycle: runningInfo.supportsLifecycle,
      configuredModelCapabilities: configuredModelCapabilities ?? undefined,
      lastSwitchResult: this.lastSwitchResult,
    };

    if (cacheTtlMs > 0) {
      this.runtimeStateCache = {
        value: runtimeState,
        expiresAt: Date.now() + cacheTtlMs,
      };
    }

    return runtimeState;
  }

  async getModelCapabilities(modelName = this.model): Promise<string[] | null> {
    const normalizedModelName = modelName.trim();
    if (!normalizedModelName) {
      return null;
    }

    if (this.capabilityCache.has(normalizedModelName)) {
      return this.capabilityCache.get(normalizedModelName) ?? null;
    }

    try {
      const data = await this.fetchJson<{ capabilities?: unknown }>(
        `${this.nativeBaseUrl}/api/show`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({ name: normalizedModelName }),
        },
        10_000,
      );

      const capabilities = Array.isArray(data.capabilities)
        ? data.capabilities
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
            .map((value) => value.toLowerCase())
        : null;
      this.capabilityCache.set(normalizedModelName, capabilities);
      return capabilities;
    } catch {
      this.capabilityCache.set(normalizedModelName, null);
      return null;
    }
  }

  async canAttemptNativeToolCalling(modelName = this.model, capabilities?: string[] | null): Promise<boolean> {
    const normalizedModelName = modelName.trim();
    if (!normalizedModelName) {
      return false;
    }

    if (Array.isArray(capabilities) && capabilities.includes('tools')) {
      return true;
    }

    const nativeChatSupported = await this.supportsOllamaNativeChat();
    if (!nativeChatSupported) {
      return false;
    }

    if (!Array.isArray(capabilities)) {
      return true;
    }

    // Ollama `/api/show` can omit `tools` for Gemma/Qwen families even when
    // `/api/chat` handles native tool calls correctly. Prefer one real native
    // attempt before dropping into manual JSON fallback.
    return /gemma|qwen/i.test(normalizedModelName);
  }

  async activateModel(requestedModel: string, previousModel: string | null = null): Promise<ModelSwitchResult> {
    const targetModel = requestedModel.trim();
    if (!targetModel) {
      throw new Error('Model name cannot be empty.');
    }

    const installedModels = await this.listInstalledModels();
    if (installedModels.length > 0 && !installedModels.includes(targetModel)) {
      throw new Error(`Model ${targetModel} is not installed in Ollama.`);
    }

    const runningInfo = await this.tryListRunningModels();
    if (!runningInfo.supportsLifecycle) {
      const result: ModelSwitchResult = {
        previousModel,
        requestedModel: targetModel,
        activeModel: null,
        runningModels: [],
        unloadedModels: [],
        loadedModel: null,
        supportsLifecycle: false,
        message: 'Model lifecycle control is unavailable for the current provider. Configuration changed, but the active model could not be switched automatically.',
      };
      this.lastSwitchResult = result;
      this.runtimeStateCache = null;
      return result;
    }

    const unloadCandidates = Array.from(
      new Set(
        runningInfo.models
          .map((entry) => entry.model || entry.name)
          .filter((modelName) => modelName && modelName !== targetModel),
      ),
    );

    for (const modelName of unloadCandidates) {
      await this.unloadModel(modelName);
    }

    await this.preloadModel(targetModel);
    this.runtimeStateCache = null;
    const runtime = await this.getRuntimeState(0);
    const loadedTarget = runtime.runningModels.find((entry) => entry.model === targetModel || entry.name === targetModel);

    if (!loadedTarget) {
      throw new Error(`Model switch failed: ${targetModel} did not become active.`);
    }

    const result: ModelSwitchResult = {
      previousModel,
      requestedModel: targetModel,
      activeModel: loadedTarget.model,
      runningModels: runtime.runningModels,
      unloadedModels: unloadCandidates,
      loadedModel: loadedTarget.model,
      supportsLifecycle: true,
      message: unloadCandidates.length > 0
        ? `Stopped ${unloadCandidates.join(', ')} and activated ${loadedTarget.model}.`
        : `Activated ${loadedTarget.model}.`,
    };

    this.lastSwitchResult = result;
    this.runtimeStateCache = null;
    return result;
  }

  private async fetchWithRetry(url: string, options: RequestInit, timeoutMs?: number): Promise<Response> {
    const effectiveTimeout = timeoutMs ?? this.timeoutMs;
    let lastError: any;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;
      let abortFromCaller: (() => void) | undefined;
      try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, effectiveTimeout);
        
        if (options.signal) {
          abortFromCaller = () => controller.abort();
          options.signal.addEventListener('abort', abortFromCaller, { once: true });
          if (options.signal.aborted) {
            controller.abort();
          }
        }

        const response = await fetch(url, {
          ...options,
          signal: controller.signal as any
        });

        if (response.ok) {
          return response;
        }

        if (response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        }

        // Return immediately for 4xx errors
        return response;

      } catch (error) {
        lastError = timedOut && (error as { name?: string })?.name === 'AbortError'
          ? new Error(`Model request timed out after ${Math.round(effectiveTimeout / 1000)}s before response.`)
          : error;
        if (attempt < this.retries) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt))); // Exponential backoff
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (options.signal && abortFromCaller) {
          options.signal.removeEventListener('abort', abortFromCaller);
        }
      }
    }
    throw lastError;
  }

  async createChatCompletion(request: ChatCompletionRequest) {
    // Always prefer native Ollama API when available — it properly handles
    // Gemma 4's native function calling tokens, thinking mode, and images.
    // The OpenAI-compat endpoint lacks support for think, images, and
    // Gemma 4's special tool control tokens.
    if (await this.supportsOllamaNativeChat()) {
      return this.createOllamaChatCompletion(request);
    }

    if (request.think === true) {
      console.warn('Model Adapter: think=true but native Ollama chat unavailable. Falling back to OpenAI-compat path; thinking may be ignored.');
    }

    const profile = PROFILES[this.profileName] || PROFILES['balanced'];
    
    const targetModel = request.model ?? this.model;
    const lowerModel = targetModel.toLowerCase();
    
    let optTemperature = request.temperature ?? profile.temperature;
    let optMaxTokens = request.max_tokens ?? profile.max_tokens;

    if (lowerModel.includes('gemma')) {
      optMaxTokens = Math.min(optMaxTokens, 8192);
      optTemperature = Math.max(0.01, optTemperature * 0.8);
    } else if (lowerModel.includes('deepseek')) {
      optMaxTokens = Math.max(optMaxTokens, 16384);
    } else if (lowerModel.includes('qwen')) {
      optTemperature = Math.min(1.0, optTemperature * 1.1);
    }
    
    const payload = {
      model: targetModel,
      messages: request.messages,
      temperature: optTemperature,
      max_tokens: optMaxTokens,
      reasoning_effort: request.reasoning_effort,
      stream: request.stream ?? false,
      tools: request.tools
    };

    const chatTimeout = Math.max(this.timeoutMs * 4, 180_000);
    const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
      signal: request.signal,
    }, chatTimeout);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Chat completion failed: ${response.status} ${text}`);
    }

    if (payload.stream) {
      return response.body; // Return readable stream
    }

    return response.json();
  }
}
