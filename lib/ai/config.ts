/**
 * AI 解读服务配置
 *
 * 开源版不含 /api/* 后端接口，本文件补上「用哪家模型、怎么连」的解析层。
 * 支持两种协议：
 *   - anthropic：Anthropic Messages 协议（/v1/messages，SSE）
 *   - openai   ：OpenAI 兼容协议（/v1/chat/completions，SSE）
 *
 * 环境变量
 *   AI_PROVIDER    预设名：anthropic | deepseek | mimo | openai | 自定义
 *   AI_PROTOCOL    覆盖协议：anthropic | openai（优先级最高）
 *   AI_BASE_URL    覆盖 base URL（不含 /messages 或 /chat/completions）
 *   AI_API_KEY     覆盖 API Key
 *   AI_MODEL       模型名
 *   AI_AUTH_MODE   鉴权方式：api-key（x-api-key 头，默认）| bearer（Authorization: Bearer 头）
 *   AI_MAX_TOKENS  单次最大输出 token，默认 4096
 *   AI_TIMEOUT_MS  单次请求超时毫秒，默认 120000
 *
 * 预设名同时兼容 .env.example 里的旧写法：
 *   AI_PROVIDER=deepseek → DEEPSEEK_API_KEY
 *   AI_PROVIDER=mimo     → MIMO_API_KEY / MIMO_BASE_URL / MIMO_MODEL
 */

export type AiProtocol = 'anthropic' | 'openai';
export type AiAuthMode = 'api-key' | 'bearer';

export interface AiConfig {
  protocol: AiProtocol;
  authMode: AiAuthMode;
  baseURL: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
}

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiConfigError';
  }
}

interface Preset {
  protocol: AiProtocol;
  authMode: AiAuthMode;
  baseURL: string;
  apiKeyEnv: string;
  model: string;
}

/** 鉴权头的默认传递方式：Anthropic 用 x-api-key，OpenAI 兼容协议用 Authorization: Bearer */
function defaultAuthFor(protocol: AiProtocol): AiAuthMode {
  return protocol === 'anthropic' ? 'api-key' : 'bearer';
}

const PRESETS: Record<string, Preset> = {
  anthropic: {
    protocol: 'anthropic',
    authMode: 'api-key',
    baseURL: 'https://api.anthropic.com/v1',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    model: '', // 模型名各家差异大，必须显式给 AI_MODEL
  },
  deepseek: {
    protocol: 'openai',
    authMode: 'bearer',
    baseURL: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    model: 'deepseek-chat',
  },
  mimo: {
    protocol: 'openai',
    authMode: 'bearer',
    baseURL: '', // 由 MIMO_BASE_URL 给
    apiKeyEnv: 'MIMO_API_KEY',
    model: '', // 由 MIMO_MODEL 给
  },
  openai: {
    protocol: 'openai',
    authMode: 'bearer',
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    model: 'gpt-4o-mini',
  },
};

function trimOrUndefined(v: string | undefined): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function toPositiveInt(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * 解析出可用的模型配置。缺关键项时抛 AiConfigError，
 * 路由层捕获后返回 500，前端会提示「请检查 API 配置」。
 */
export function resolveAiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  const providerName = (trimOrUndefined(env.AI_PROVIDER) ?? 'anthropic').toLowerCase();
  const preset = PRESETS[providerName];

  const explicitProtocol = trimOrUndefined(env.AI_PROTOCOL)?.toLowerCase();
  const protocolRaw = explicitProtocol ?? preset?.protocol ?? 'anthropic';
  if (protocolRaw !== 'anthropic' && protocolRaw !== 'openai') {
    throw new AiConfigError(`AI_PROTOCOL 只能是 anthropic 或 openai，收到「${protocolRaw}」`);
  }
  const protocol: AiProtocol = protocolRaw;

  // 显式指定协议时，默认鉴权方式跟着协议走；否则用预设的
  const explicitAuth = trimOrUndefined(env.AI_AUTH_MODE)?.toLowerCase();
  const authRaw = explicitAuth ?? (explicitProtocol ? defaultAuthFor(protocol) : preset?.authMode ?? defaultAuthFor(protocol));
  if (authRaw !== 'api-key' && authRaw !== 'bearer') {
    throw new AiConfigError(`AI_AUTH_MODE 只能是 api-key 或 bearer，收到「${authRaw}」`);
  }
  const authMode: AiAuthMode = authRaw;

  // mimo 预设的 baseURL / model 来自它自己的变量
  const presetBaseURL = providerName === 'mimo' ? trimOrUndefined(env.MIMO_BASE_URL) : preset?.baseURL;
  const baseURL = trimOrUndefined(env.AI_BASE_URL) ?? presetBaseURL;
  if (!baseURL) {
    throw new AiConfigError(
      providerName === 'mimo'
        ? '缺少 MIMO_BASE_URL（或设置 AI_BASE_URL）'
        : `未知的 AI_PROVIDER「${providerName}」，请改用 anthropic / deepseek / mimo / openai，或直接设置 AI_BASE_URL`
    );
  }

  const presetKey = preset ? trimOrUndefined(env[preset.apiKeyEnv]) : undefined;
  const apiKey = trimOrUndefined(env.AI_API_KEY) ?? presetKey;
  if (!apiKey) {
    const hint = preset ? preset.apiKeyEnv : 'AI_API_KEY';
    throw new AiConfigError(`缺少 API Key：请设置 ${hint}（或 AI_API_KEY）`);
  }

  const presetModel = providerName === 'mimo' ? trimOrUndefined(env.MIMO_MODEL) : preset?.model;
  const model = trimOrUndefined(env.AI_MODEL) ?? presetModel;
  if (!model) {
    throw new AiConfigError('缺少模型名：请设置 AI_MODEL');
  }

  return {
    protocol,
    authMode,
    baseURL: baseURL.replace(/\/+$/, ''),
    apiKey,
    model,
    // 带 thinking 的模型会先花掉一大截预算做思考，默认给足 16K；
    // OpenAI 兼容厂商有输出上限时（DeepSeek 最高 8K）请调小 AI_MAX_TOKENS。
    maxTokens: toPositiveInt(env.AI_MAX_TOKENS, 16_384),
    timeoutMs: toPositiveInt(env.AI_TIMEOUT_MS, 120_000),
  };
}

/** 给用户看的当前配置摘要（不泄露 key） */
export function describeAiConfig(cfg: AiConfig): string {
  return `${cfg.protocol} 协议 · ${cfg.authMode} 鉴权 · ${cfg.baseURL} · 模型 ${cfg.model}`;
}
