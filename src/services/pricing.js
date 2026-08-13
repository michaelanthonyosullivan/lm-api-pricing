// Live per-token pricing sourced from OpenRouter's public model catalog.
// OpenRouter aggregates pricing for all major LM providers (OpenAI, Anthropic,
// Google, Meta, xAI, DeepSeek, Mistral, Qwen, Cohere, NVIDIA, Amazon, ...).
// The endpoint is public — no API key required.

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'

/**
 * Fetches the latest model catalog and normalizes it into a flat list of
 * { id, provider, name, contextLength, modality, inputPrice, outputPrice }.
 * Prices are USD per token (OpenRouter's unit) — multiply by 1_000_000 for
 * the conventional $/M pricing shown in the UI.
 */
export async function fetchModelPricing() {
  const res = await fetch(OPENROUTER_MODELS_URL, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Pricing service returned HTTP ${res.status}`)
  }
  const json = await res.json()
  if (!Array.isArray(json?.data)) {
    throw new Error('Unexpected response shape from pricing service')
  }

  const models = json.data
    .map(normalize)
    // Keep only models with a real per-token price; drops routers priced at -1.
    .filter((m) => m.inputPrice > 0 || m.outputPrice > 0)

  const providers = [...new Set(models.map((m) => m.provider))].sort((a, b) =>
    a.localeCompare(b),
  )

  return { models, providers, fetchedAt: new Date() }
}

function normalize(m) {
  const id = m.id || ''
  const rawProvider = id.includes('/') ? id.split('/')[0] : m.provider || 'other'
  const pricing = m.pricing || {}
  return {
    id,
    provider: prettyProvider(rawProvider),
    providerKey: rawProvider,
    name: m.name || id,
    contextLength: m.context_length || 0,
    modality: m.architecture?.modality || '',
    inputPrice: toUsd(pricing.prompt),
    outputPrice: toUsd(pricing.completion),
  }
}

function toUsd(value) {
  const n = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN
  return Number.isFinite(n) && n > 0 ? n : 0
}

const PROVIDER_NAMES = {
  'x-ai': 'xAI',
  'meta-llama': 'Meta',
  mistralai: 'Mistral',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  'z-ai': 'Z.ai',
  'bytedance-seed': 'ByteDance',
  moonshotai: 'MoonshotAI',
  nvidia: 'NVIDIA',
  amazon: 'Amazon',
  microsoft: 'Microsoft',
  cohere: 'Cohere',
  perplexity: 'Perplexity',
  'ibm-granite': 'IBM',
  minimax: 'MiniMax',
  tencent: 'Tencent',
  baidu: 'Baidu',
  stepfun: 'StepFun',
  inclusionai: 'inclusionAI',
  sakana: 'Sakana',
  upstage: 'Upstage',
  writer: 'Writer',
  'aion-labs': 'AionLabs',
  kwaipilot: 'Kwaipilot',
  poolside: 'Poolside',
  thinkingmachines: 'Thinking Machines',
  liquid: 'Liquid AI',
  meituan: 'Meituan',
  xiaomi: 'Xiaomi',
  'nex-agi': 'Nex AGI',
  rekaai: 'Reka',
  deepcogito: 'Deep Cogito',
  allenai: 'AllenAI',
  ai21: 'AI21',
  'arcee-ai': 'Arcee AI',
  nousresearch: 'Nous',
  openrouter: 'OpenRouter',
  morph: 'Morph',
  relace: 'Relace',
  inception: 'Inception',
  venice: 'Venice',
  'anthracite-org': 'Anthracite',
  them: 'TheDrummer',
  thedrummer: 'TheDrummer',
  undi95: 'Undi95',
  sao10k: 'Sao10K',
  mancer: 'Mancer',
  gryphe: 'Gryphe',
  perceptron: 'Perceptron',
}

function prettyProvider(raw) {
  if (PROVIDER_NAMES[raw]) return PROVIDER_NAMES[raw]
  // Fallback: strip leading "~" and title-case the rest.
  const cleaned = raw.replace(/^~/, '')
  return cleaned
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Formats a USD-per-token value as per-1M or per-1K, e.g. "$1.25" / "$0.00125". */
export function formatPrice(perToken, unit) {
  if (!perToken || perToken <= 0) return 'Free'
  const scaled = unit === 'M' ? perToken * 1_000_000 : perToken * 1_000
  const symbol = unit === 'M' ? '$' : '$'
  if (scaled >= 100) return `${symbol}${scaled.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (scaled >= 1) return `${symbol}${scaled.toFixed(2)}`
  if (scaled >= 0.01) return `${symbol}${scaled.toFixed(3)}`
  return `${symbol}${scaled.toFixed(4)}`
}

/** Formats a context length as "128K", "1M", "8K" … */
export function formatContext(length) {
  if (!length) return '—'
  if (length >= 1_000_000) {
    const m = length / 1_000_000
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`
  }
  if (length >= 1_000) {
    const k = length / 1_000
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`
  }
  return String(length)
}
