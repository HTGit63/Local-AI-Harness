import {
  AdapterOptions,
  AvailableModel,
  ChatCompletionRequest,
  ChatMessage,
  ModelRuntimeState,
  ModelSwitchResult,
  RuntimeEndpointStatus,
  RunningModel,
  RuntimeProvider,
} from './types';
import { DEFAULT_CONFIG, PROFILES } from './config';
import {
  buildRuntimeSelectionConfig,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  RuntimeEndpointConfig,
  RuntimeSelectionConfig,
} from './runtime-config';

type ReasoningEffort = ChatCompletionRequest['reasoning_effort'];

const MODEL_PRELOAD_KEEP_ALIVE = '2m';
const MODEL_UNLOAD_KEEP_ALIVE = 0;
const MODEL_CHAT_TIMEOUT_MIN_MS = 180_000;
const MODEL_PRELOAD_TIMEOUT_MIN_MS = 120_000;
const MODEL_UNLOAD_TIMEOUT_MIN_MS = 30_000;
const MODEL_OUTPUT_CAPS = {
  default: 2048,
  gemma: 2048,
  deepseek: 2048,
  qwen: 1536,
} as const;

interface RuntimeRoute {
  active: RuntimeEndpointConfig;
  primaryStatus: RuntimeEndpointStatus;
  fallbackStatus?: RuntimeEndpointStatus;
  fallbackWarning?: string;
}

function joinWarnings(...warnings: Array<string | undefined>): string | undefined {
  const compact = warnings.map((warning) => warning?.trim()).filter((warning): warning is string => Boolean(warning));
  return compact.length > 0 ? compact.join(' ') : undefined;
}

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

function outputTokenCapForModel(modelName: string): number {
  const lowerModel = modelName.toLowerCase();
  if (lowerModel.includes('qwen')) {
    return MODEL_OUTPUT_CAPS.qwen;
  }
  if (lowerModel.includes('gemma')) {
    return MODEL_OUTPUT_CAPS.gemma;
  }
  if (lowerModel.includes('deepseek')) {
    return MODEL_OUTPUT_CAPS.deepseek;
  }
  return MODEL_OUTPUT_CAPS.default;
}

function clampOutputTokens(modelName: string, requestedTokens: number): number {
  return Math.max(1, Math.min(requestedTokens, outputTokenCapForModel(modelName)));
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
  private provider: RuntimeProvider;
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
  private runtimeSelection: RuntimeSelectionConfig;
  private runtimeRouteCache: { value: RuntimeRoute; expiresAt: number } | null = null;

  constructor(options: Partial<AdapterOptions> = {}) {
    const requestedProvider = options.provider ?? DEFAULT_CONFIG.provider;
    this.provider = requestedProvider;
    this.baseUrl = options.baseUrl
      ?? (requestedProvider === 'ollama-legacy' ? process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL : DEFAULT_CONFIG.baseUrl);
    this.apiKey = options.apiKey
      ?? (requestedProvider === 'ollama-legacy' ? process.env.OLLAMA_API_KEY || 'ollama' : DEFAULT_CONFIG.apiKey);
    this.model = options.model
      ?? (requestedProvider === 'ollama-legacy' ? process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL : DEFAULT_CONFIG.model);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_CONFIG.timeoutMs;
    this.retries = options.retries ?? DEFAULT_CONFIG.retries;
    this.profileName = options.profile ?? DEFAULT_CONFIG.profile;
    this.runtimeSelection = this.buildRuntimeSelection(options);
  }

  updateConfig(options: Partial<AdapterOptions> = {}) {
    if (options.provider !== undefined) {
      this.provider = options.provider;
      this.capabilityCache.clear();
      this.nativeChatSupported = null;
      this.runtimeStateCache = null;
      this.runtimeRouteCache = null;
    }
    if (options.baseUrl !== undefined) {
      this.baseUrl = options.baseUrl;
      this.capabilityCache.clear();
      this.nativeChatSupported = null;
      this.runtimeStateCache = null;
      this.runtimeRouteCache = null;
    }
    if (options.apiKey !== undefined) {
      this.apiKey = options.apiKey;
      this.runtimeStateCache = null;
      this.runtimeRouteCache = null;
    }
    if (options.model !== undefined) {
      this.model = options.model;
      this.runtimeStateCache = null;
      this.runtimeRouteCache = null;
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
    this.runtimeSelection = this.buildRuntimeSelection(options);
  }

  private buildRuntimeSelection(options: Partial<AdapterOptions>) {
    const selectionOptions = { ...options };
    if (this.provider !== 'llamacpp') {
      delete selectionOptions.provider;
      delete selectionOptions.baseUrl;
      delete selectionOptions.apiKey;
      delete selectionOptions.model;
    }
    const activePrimaryOverrides = this.provider === 'llamacpp'
      ? {
          provider: this.provider,
          baseUrl: this.baseUrl,
          apiKey: this.apiKey,
          model: this.model,
        }
      : {};

    return buildRuntimeSelectionConfig({
      ...selectionOptions,
      ...activePrimaryOverrides,
    });
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
  }

  private endpointHeaders(endpoint: RuntimeEndpointConfig) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${endpoint.apiKey}`,
    };
  }

  private get nativeBaseUrl() {
    return this.baseUrl.replace(/\/v1\/?$/, '');
  }

  private isOllamaLegacyProvider(): boolean {
    return this.provider === 'ollama-legacy';
  }

  private makeEndpointStatus(
    endpoint: RuntimeEndpointConfig,
    status: RuntimeEndpointStatus['status'],
    error?: string,
    warning?: string,
    availableModels?: AvailableModel[],
  ): RuntimeEndpointStatus {
    return {
      provider: endpoint.provider,
      baseUrl: endpoint.baseUrl,
      model: endpoint.model,
      availableModels,
      modelPath: endpoint.modelPath,
      modelAlias: endpoint.modelAlias,
      status,
      isPrimary: endpoint.isPrimary,
      isFallback: endpoint.isFallback,
      error,
      warning,
      checkedAt: Date.now(),
    };
  }

  private async checkRuntimeEndpoint(endpoint: RuntimeEndpointConfig): Promise<RuntimeEndpointStatus> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.runtimeSelection.healthCheckTimeoutMs);
    try {
      const response = await fetch(`${endpoint.baseUrl}/models`, {
        method: 'GET',
        headers: this.endpointHeaders(endpoint),
        signal: controller.signal as any,
      });
      if (response.ok) {
        let payload: { data?: AvailableModel[] };
        try {
          payload = await response.json() as { data?: AvailableModel[] };
        } catch {
          return this.makeEndpointStatus(endpoint, 'unavailable', 'Invalid /models JSON response');
        }
        if (!Array.isArray(payload.data)) {
          return this.makeEndpointStatus(endpoint, 'unavailable', 'Invalid /models response: missing data[]');
        }
        return this.makeEndpointStatus(endpoint, 'connected', undefined, undefined, payload.data);
      }
      return this.makeEndpointStatus(endpoint, 'unavailable', `HTTP ${response.status}`);
    } catch (error: any) {
      const offline = error?.name === 'AbortError' ? 'health check timed out' : error?.message || String(error);
      return this.makeEndpointStatus(endpoint, 'offline', offline);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private shouldAutoFallback(): boolean {
    return this.provider === 'llamacpp' && this.runtimeSelection.fallbackEnabled && Boolean(this.runtimeSelection.fallback);
  }

  private selectListedEndpointModel(
    endpoint: RuntimeEndpointConfig,
    status: RuntimeEndpointStatus,
  ): { endpoint: RuntimeEndpointConfig; status: RuntimeEndpointStatus; warning?: string } {
    if (status.status !== 'connected' || !Array.isArray(status.availableModels) || status.availableModels.length === 0) {
      return { endpoint, status };
    }

    const ids = status.availableModels
      .map((model) => model.id)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    if (ids.length === 0 || ids.includes(endpoint.model)) {
      return { endpoint, status };
    }

    const preferred = [
      /(^|\/)gemma4:e4b($|[-:])/i,
      /(^|\/)gemma4:e2b($|[-:])/i,
      /(^|\/)gemma4:12b($|[-:])/i,
      /gemma/i,
    ].reduce<string | undefined>((match, pattern) => match ?? ids.find((id) => pattern.test(id)), undefined) ?? ids[0];
    if (!preferred) {
      return { endpoint, status };
    }

    const warning = `Configured model ${endpoint.model} was not listed at ${endpoint.baseUrl}; using ${preferred}.`;
    return {
      endpoint: { ...endpoint, model: preferred },
      status: {
        ...status,
        model: preferred,
        warning: joinWarnings(status.warning, warning),
      },
      warning,
    };
  }

  private async resolveRuntimeRoute(cacheTtlMs = 10_000): Promise<RuntimeRoute> {
    const now = Date.now();
    if (cacheTtlMs > 0 && this.runtimeRouteCache && this.runtimeRouteCache.expiresAt > now) {
      return this.runtimeRouteCache.value;
    }

    const primary = {
      ...this.runtimeSelection.primary,
      provider: this.provider === 'llamacpp' ? this.provider : this.runtimeSelection.primary.provider,
      baseUrl: this.provider === 'llamacpp' ? this.baseUrl : this.runtimeSelection.primary.baseUrl,
      apiKey: this.provider === 'llamacpp' ? this.apiKey : this.runtimeSelection.primary.apiKey,
      model: this.provider === 'llamacpp' ? this.model : this.runtimeSelection.primary.model,
      isPrimary: true,
      isFallback: false,
    } satisfies RuntimeEndpointConfig;

    if (!this.shouldAutoFallback()) {
      const active: RuntimeEndpointConfig = {
        provider: this.provider,
        baseUrl: this.baseUrl,
        apiKey: this.apiKey,
        model: this.model,
        modelPath: this.provider === 'llamacpp' ? this.runtimeSelection.primary.modelPath : undefined,
        modelAlias: this.provider === 'llamacpp' ? this.runtimeSelection.primary.modelAlias : undefined,
        isPrimary: this.provider === this.runtimeSelection.primary.provider,
        isFallback: false,
      };
      const activeStatus = await this.checkRuntimeEndpoint(active);
      const selectedActive = this.selectListedEndpointModel(active, activeStatus);
      const primaryStatusRaw = this.provider === 'llamacpp'
        ? selectedActive.status
        : await this.checkRuntimeEndpoint(primary);
      const selectedPrimary = this.provider === 'llamacpp'
        ? selectedActive
        : this.selectListedEndpointModel(primary, primaryStatusRaw);
      const configuredFallback = this.runtimeSelection.fallback;
      const fallbackStatus = this.provider === 'ollama-legacy' && configuredFallback && configuredFallback.provider !== this.provider
        ? this.selectListedEndpointModel(configuredFallback, await this.checkRuntimeEndpoint(configuredFallback)).status
        : undefined;
      const route: RuntimeRoute = {
        active: selectedActive.endpoint,
        primaryStatus: selectedPrimary.status,
        fallbackStatus,
        fallbackWarning: selectedActive.warning,
      };
      if (cacheTtlMs > 0) {
        this.runtimeRouteCache = { value: route, expiresAt: Date.now() + cacheTtlMs };
      }
      return route;
    }

    const primaryStatus = await this.checkRuntimeEndpoint(primary);
    const selectedPrimary = this.selectListedEndpointModel(primary, primaryStatus);
    if (selectedPrimary.status.status === 'connected') {
      const route: RuntimeRoute = {
        active: selectedPrimary.endpoint,
        primaryStatus: selectedPrimary.status,
        fallbackWarning: selectedPrimary.warning,
      };
      if (cacheTtlMs > 0) {
        this.runtimeRouteCache = { value: route, expiresAt: Date.now() + cacheTtlMs };
      }
      return route;
    }

    const fallback = this.runtimeSelection.fallback!;
    const fallbackStatusRaw = await this.checkRuntimeEndpoint(fallback);
    const selectedFallback = this.selectListedEndpointModel(fallback, fallbackStatusRaw);
    const primaryFallbackWarning = selectedFallback.status.status === 'connected'
      ? `Using ${selectedFallback.endpoint.provider} fallback because ${primary.provider} primary is unavailable at ${primary.baseUrl}.`
      : undefined;
    const fallbackWarning = joinWarnings(primaryFallbackWarning, selectedFallback.warning);
    const fallbackStatus = this.makeEndpointStatus(
      selectedFallback.endpoint,
      selectedFallback.status.status,
      selectedFallback.status.error,
      fallbackWarning,
      selectedFallback.status.availableModels,
    );
    const route: RuntimeRoute = {
      active: fallbackStatus.status === 'connected' ? selectedFallback.endpoint : selectedPrimary.endpoint,
      primaryStatus: selectedPrimary.status,
      fallbackStatus,
      fallbackWarning,
    };
    if (cacheTtlMs > 0) {
      this.runtimeRouteCache = { value: route, expiresAt: Date.now() + cacheTtlMs };
    }
    return route;
  }

  private async withRuntimeEndpoint<T>(endpoint: RuntimeEndpointConfig, fn: () => Promise<T>): Promise<T> {
    const previous = {
      provider: this.provider,
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      model: this.model,
      nativeChatSupported: this.nativeChatSupported,
    };
    this.provider = endpoint.provider;
    this.baseUrl = endpoint.baseUrl;
    this.apiKey = endpoint.apiKey;
    this.model = endpoint.model;
    this.nativeChatSupported = null;
    try {
      return await fn();
    } finally {
      this.provider = previous.provider;
      this.baseUrl = previous.baseUrl;
      this.apiKey = previous.apiKey;
      this.model = previous.model;
      this.nativeChatSupported = previous.nativeChatSupported;
    }
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
    if (!this.isOllamaLegacyProvider()) {
      this.nativeChatSupported = false;
      return false;
    }
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

    // Model-specific tuning keeps local output bounded; context is handled outside num_predict.
    if (lowerModel.includes('gemma')) {
      optTemperature = Math.max(0.01, optTemperature * 0.8);
    } else if (lowerModel.includes('deepseek')) {
      optTemperature = Math.max(0.01, optTemperature * 0.95);
    } else if (lowerModel.includes('qwen')) {
      optTemperature = Math.min(1.0, optTemperature * 1.1);
    }
    optMaxTokens = clampOutputTokens(targetModel, optMaxTokens);

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
    if (!this.isOllamaLegacyProvider()) {
      return {
        supportsLifecycle: false,
        models: [],
      };
    }
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
    if (!this.isOllamaLegacyProvider()) {
      const models = await this.listModelsFromConfiguredEndpoint();
      return models
        .map((entry) => entry.id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0);
    }
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
    if (!this.isOllamaLegacyProvider()) {
      return;
    }
    await this.fetchJson(
      `${this.nativeBaseUrl}/api/generate`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model: modelName,
          keep_alive: MODEL_UNLOAD_KEEP_ALIVE,
        }),
      },
      Math.max(this.timeoutMs, MODEL_UNLOAD_TIMEOUT_MIN_MS),
    );
  }

  private async preloadModel(modelName: string): Promise<void> {
    if (!this.isOllamaLegacyProvider()) {
      return;
    }
    await this.fetchJson(
      `${this.nativeBaseUrl}/api/generate`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model: modelName,
          prompt: '',
          stream: false,
          keep_alive: MODEL_PRELOAD_KEEP_ALIVE,
        }),
      },
      Math.max(this.timeoutMs * 4, MODEL_PRELOAD_TIMEOUT_MIN_MS),
    );
  }

  async isHealthy(): Promise<boolean> {
    const route = await this.resolveRuntimeRoute(0);
    if (route.active.isFallback && route.fallbackStatus) {
      return route.fallbackStatus.status === 'connected';
    }
    return route.primaryStatus.status === 'connected';
  }

  private async listModelsFromConfiguredEndpoint(): Promise<any[]> {
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

  async listModels(): Promise<any[]> {
    const route = await this.resolveRuntimeRoute();
    return this.withRuntimeEndpoint(route.active, () => this.listModelsFromConfiguredEndpoint());
  }

  async getRuntimeState(cacheTtlMs = 10_000): Promise<ModelRuntimeState> {
    const now = Date.now();
    if (cacheTtlMs > 0 && this.runtimeStateCache && this.runtimeStateCache.expiresAt > now) {
      return this.runtimeStateCache.value;
    }

    const route = await this.resolveRuntimeRoute(cacheTtlMs);
    const activeStatus = route.active.isFallback && route.fallbackStatus
      ? route.fallbackStatus
      : route.primaryStatus;
    const runtimeState = await this.withRuntimeEndpoint(route.active, async () => {
    const healthy = activeStatus.status === 'connected';
    const availableModels = healthy ? await this.listModelsFromConfiguredEndpoint() as AvailableModel[] : [];
    const installedModels = healthy ? await this.listInstalledModels() : [];
    const runningInfo = healthy ? await this.tryListRunningModels() : { supportsLifecycle: false, models: [] as RunningModel[] };
    const runningModels = runningInfo.models;
    const configuredModelActive = runningModels.find((entry) => entry.model === this.model || entry.name === this.model);
    const configuredModelListed = availableModels.some((entry) => entry.id === this.model);
    const runtimeStatus: ModelRuntimeState['runtimeStatus'] = this.isOllamaLegacyProvider()
      ? (!runningInfo.supportsLifecycle || !healthy
          ? 'unavailable'
          : configuredModelActive
            ? 'ready'
            : runningModels.length > 0
              ? 'configured_not_loaded'
              : 'idle')
      : (!healthy
          ? 'unavailable'
          : configuredModelListed || availableModels.length > 0
            ? 'ready'
            : 'configured_not_loaded');
    const statusMessage = this.isOllamaLegacyProvider()
      ? (!runningInfo.supportsLifecycle || !healthy
          ? 'Ollama legacy lifecycle status is unavailable.'
          : configuredModelActive
            ? `Configured model ${this.model} is loaded.`
            : runningModels.length > 0
              ? `Configured model ${this.model} is not loaded; ${runningModels.length} other model${runningModels.length === 1 ? ' is' : 's are'} running.`
              : `Configured model ${this.model} is idle.`)
      : (!healthy
          ? `${this.provider} server is not reachable at ${this.baseUrl}.`
          : configuredModelListed
            ? `${this.provider} server is reachable and lists ${this.model}.`
            : `${this.provider} server is reachable; configured model ${this.model} was not listed.`);
    const configuredModelCapabilities = await this.getModelCapabilities(this.model);
    const reasoningSupported = Array.isArray(configuredModelCapabilities)
      ? configuredModelCapabilities.some((capability) => capability === 'thinking' || capability === 'reasoning')
      : undefined;
    const nativeToolCallingSupported = await this.canAttemptNativeToolCalling(this.model, configuredModelCapabilities);

    return {
      provider: this.provider,
      baseUrl: this.baseUrl,
      activeProvider: route.active.provider,
      activeBaseUrl: route.active.baseUrl,
      configuredModel: this.model,
      activeModel: this.isOllamaLegacyProvider()
        ? configuredModelActive?.model || (runningModels.length === 1 ? runningModels[0].model : null)
        : healthy ? this.model : null,
      runtimeStatus,
      statusMessage,
      primaryRuntime: route.primaryStatus,
      fallbackRuntime: route.fallbackStatus,
      fallbackEnabled: this.runtimeSelection.fallbackEnabled,
      fallbackWarning: route.fallbackWarning,
      modelPath: route.active.modelPath ?? route.primaryStatus.modelPath,
      modelAlias: route.active.modelAlias ?? route.primaryStatus.modelAlias,
      runningModels,
      installedModels,
      availableModels,
      supportsLifecycle: runningInfo.supportsLifecycle,
      lifecyclePolicy: {
        preloadKeepAlive: MODEL_PRELOAD_KEEP_ALIVE,
        unloadKeepAlive: MODEL_UNLOAD_KEEP_ALIVE,
        chatTimeoutMs: Math.max(this.timeoutMs * 4, MODEL_CHAT_TIMEOUT_MIN_MS),
        preloadTimeoutMs: Math.max(this.timeoutMs * 4, MODEL_PRELOAD_TIMEOUT_MIN_MS),
        unloadTimeoutMs: Math.max(this.timeoutMs, MODEL_UNLOAD_TIMEOUT_MIN_MS),
      },
      reasoningSupported,
      nativeToolCallingSupported,
      configuredModelCapabilities: configuredModelCapabilities ?? undefined,
      lastSwitchResult: this.lastSwitchResult,
    };
    });

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

    if (!this.isOllamaLegacyProvider()) {
      const lower = normalizedModelName.toLowerCase();
      const capabilities = lower.includes('gemma') ? ['tools'] : null;
      this.capabilityCache.set(normalizedModelName, capabilities);
      return capabilities;
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

    if (!this.isOllamaLegacyProvider()) {
      if (Array.isArray(capabilities)) {
        return capabilities.includes('tools');
      }
      return /gemma/i.test(normalizedModelName);
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

    if (!this.isOllamaLegacyProvider()) {
      this.model = targetModel;
      this.runtimeStateCache = null;
      this.runtimeRouteCache = null;
      this.runtimeSelection = this.buildRuntimeSelection({});
      const route = await this.resolveRuntimeRoute(0);
      const primaryHealthy = route.primaryStatus.status === 'connected';
      const fallbackHealthy = route.active.isFallback && route.fallbackStatus?.status === 'connected';
      const result: ModelSwitchResult = {
        previousModel,
        requestedModel: targetModel,
        activeModel: primaryHealthy ? targetModel : fallbackHealthy ? route.active.model : null,
        runningModels: [],
        unloadedModels: [],
        loadedModel: primaryHealthy ? targetModel : fallbackHealthy ? route.active.model : null,
        supportsLifecycle: false,
        message: primaryHealthy
          ? `${this.provider} is reachable. Configured ${targetModel}; lifecycle warmup is not managed by the harness.`
          : fallbackHealthy
            ? `${this.provider} is unavailable at ${this.baseUrl}. ${route.active.provider} fallback is active with ${route.active.model}.`
            : `${this.provider} is not reachable at ${this.baseUrl}. Configured ${targetModel}, but no runtime is active.`,
      };
      this.lastSwitchResult = result;
      this.capabilityCache.clear();
      this.runtimeStateCache = null;
      this.runtimeRouteCache = null;
      return result;
    }

    const installedModels = await this.listInstalledModels();
    if (installedModels.length > 0 && !installedModels.includes(targetModel)) {
      throw new Error(`Model ${targetModel} is not installed in Ollama legacy runtime.`);
    }
    this.model = targetModel;
    this.runtimeStateCache = null;
    this.runtimeRouteCache = null;
    this.runtimeSelection = this.buildRuntimeSelection({});

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
      this.runtimeRouteCache = null;
      return result;
    }

    const targetAlreadyRunning = runningInfo.models.find((entry) => entry.model === targetModel || entry.name === targetModel);
    if (!targetAlreadyRunning) {
      await this.preloadModel(targetModel);
    }
    this.runtimeStateCache = null;
    this.runtimeRouteCache = null;
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
      unloadedModels: [],
      loadedModel: loadedTarget.model,
      supportsLifecycle: true,
      message: targetAlreadyRunning
        ? `${loadedTarget.model} was already loaded.`
        : `Activated ${loadedTarget.model}; other running models were left unchanged.`,
    };

    this.lastSwitchResult = result;
    this.runtimeStateCache = null;
    this.runtimeRouteCache = null;
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
    const route = await this.resolveRuntimeRoute();
    const shouldUseActiveEndpointModel = request.model === undefined || request.model === this.model;
    const routedRequest = shouldUseActiveEndpointModel
      ? { ...request, model: route.active.model }
      : request;
    return this.withRuntimeEndpoint(route.active, () => this.createChatCompletionOnConfiguredEndpoint(routedRequest));
  }

  private async createChatCompletionOnConfiguredEndpoint(request: ChatCompletionRequest) {
    // Ollama native chat is an optional legacy path. The stable path is
    // OpenAI-compatible /v1 for llama.cpp and custom runtimes.
    if (await this.supportsOllamaNativeChat()) {
      return this.createOllamaChatCompletion(request);
    }

    if (request.think === true && this.isOllamaLegacyProvider()) {
      console.warn('Model Adapter: think=true but native Ollama chat unavailable. Falling back to OpenAI-compat path; thinking may be ignored.');
    }

    const profile = PROFILES[this.profileName] || PROFILES['balanced'];
    
    const targetModel = request.model ?? this.model;
    const lowerModel = targetModel.toLowerCase();
    
    let optTemperature = request.temperature ?? profile.temperature;
    let optMaxTokens = request.max_tokens ?? profile.max_tokens;

    if (lowerModel.includes('gemma')) {
      optTemperature = Math.max(0.01, optTemperature * 0.8);
    } else if (lowerModel.includes('deepseek')) {
      optTemperature = Math.max(0.01, optTemperature * 0.95);
    } else if (lowerModel.includes('qwen')) {
      optTemperature = Math.min(1.0, optTemperature * 1.1);
    }
    optMaxTokens = clampOutputTokens(targetModel, optMaxTokens);
    
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
