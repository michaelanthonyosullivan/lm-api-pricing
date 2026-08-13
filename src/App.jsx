import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchModelPricing,
  formatContext,
  formatPrice,
} from './services/pricing.js'

const SORTS = [
  { id: 'input-asc', label: 'Price · cheapest first' },
  { id: 'input-desc', label: 'Price · most expensive first' },
  { id: 'output-asc', label: 'Output price · cheapest first' },
  { id: 'context-desc', label: 'Context · largest first' },
  { id: 'name', label: 'Model · A–Z' },
]

const CONTEXT_FILTERS = [
  { id: 0, label: 'Any context' },
  { id: 8_000, label: '≥ 8K tokens' },
  { id: 32_000, label: '≥ 32K tokens' },
  { id: 128_000, label: '≥ 128K tokens' },
  { id: 1_000_000, label: '≥ 1M tokens' },
]

function providerHue(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

export default function App() {
  const [models, setModels] = useState([])
  const [providers, setProviders] = useState([])
  const [fetchedAt, setFetchedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState('all')
  const [minContext, setMinContext] = useState(0)
  const [sort, setSort] = useState('input-asc')
  const [unit, setUnit] = useState('M')

  const requestId = useRef(0)

  const load = async () => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const data = await fetchModelPricing()
      if (id !== requestId.current) return // stale response
      setModels(data.models)
      setProviders(data.providers)
      setFetchedAt(data.fetchedAt)
    } catch (err) {
      if (id !== requestId.current) return
      setError(err.message || 'Failed to load pricing data')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }

  // Fresh fetch on every mount (page load / refresh).
  useEffect(() => {
    load()
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = models.filter((m) => {
      if (provider !== 'all' && m.provider !== provider) return false
      if (minContext && m.contextLength < minContext) return false
      if (q) {
        const hay = `${m.name} ${m.provider} ${m.id}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    const sorted = [...filtered]
    switch (sort) {
      case 'input-asc':
        sorted.sort((a, b) => a.inputPrice - b.inputPrice || b.contextLength - a.contextLength)
        break
      case 'input-desc':
        sorted.sort((a, b) => b.inputPrice - a.inputPrice)
        break
      case 'output-asc':
        sorted.sort((a, b) => a.outputPrice - b.outputPrice || a.inputPrice - b.inputPrice)
        break
      case 'context-desc':
        sorted.sort((a, b) => b.contextLength - a.contextLength)
        break
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      default:
        break
    }
    return sorted
  }, [models, query, provider, minContext, sort])

  const maxPrice = useMemo(
    () => Math.max(...visible.map((m) => m.inputPrice), 0),
    [visible],
  )

  const cheapest = useMemo(() => {
    if (!models.length) return null
    return models.reduce((best, m) =>
      m.inputPrice < best.inputPrice ? m : best,
    )
  }, [models])

  const unitLabel = unit === 'M' ? '/1M tokens' : '/1K tokens'

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-top">
            <span className="logo" aria-hidden="true">$</span>
            <div>
              <h1>LLM API Pricing</h1>
              <p className="tagline">
                Every major provider, live per-token rates, cheapest first.
              </p>
            </div>
          </div>

          <div className="hero-meta">
            <div className="stat">
              <span className="stat-value">{models.length.toLocaleString()}</span>
              <span className="stat-label">models tracked</span>
            </div>
            <div className="stat">
              <span className="stat-value">{providers.length}</span>
              <span className="stat-label">providers</span>
            </div>
            {cheapest && (
              <div className="stat">
                <span className="stat-value stat-price">
                  {formatPrice(cheapest.inputPrice, unit)}
                  <small>{unitLabel}</small>
                </span>
                <span className="stat-label">cheapest input — {cheapest.name}</span>
              </div>
            )}
            <button className="refresh" onClick={load} disabled={loading}>
              <span className={loading ? 'spin' : ''}>⟳</span>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <div className="freshness">
            <span className="pulse" aria-hidden="true" />
            {fetchedAt
              ? `Live data fetched at ${fetchedAt.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })} on ${fetchedAt.toLocaleDateString([], {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })} — this page always reloads the latest prices`
              : 'Fetching latest prices…'}
          </div>
        </div>
      </header>

      <main className="content">
        <section className="controls" aria-label="Filters">
          <label className="search">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Search models, providers…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <label className="select">
            <span>Provider</span>
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="all">All providers ({providers.length})</option>
              {providers.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>

          <label className="select">
            <span>Context</span>
            <select
              value={minContext}
              onChange={(e) => setMinContext(Number(e.target.value))}
            >
              {CONTEXT_FILTERS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>

          <label className="select">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>

          <div className="segmented" role="group" aria-label="Price unit">
            <button
              className={unit === 'M' ? 'active' : ''}
              onClick={() => setUnit('M')}
            >
              per 1M
            </button>
            <button
              className={unit === 'K' ? 'active' : ''}
              onClick={() => setUnit('K')}
            >
              per 1K
            </button>
          </div>
        </section>

        {error && (
          <div className="error" role="alert">
            <strong>Couldn't load pricing.</strong> {error} — check your
            connection and try again.
            <button onClick={load}>Retry</button>
          </div>
        )}

        {loading && !models.length ? (
          <div className="skeleton" aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton-row" />
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="rank">#</th>
                  <th>Model</th>
                  <th>Provider</th>
                  <th className="num">Context</th>
                  <th className="num">Input {unitLabel}</th>
                  <th className="num">Output {unitLabel}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((m, i) => (
                  <tr key={m.id}>
                    <td className="rank dim">{i + 1}</td>
                    <td>
                      <a
                        className="model-link"
                        href={`https://openrouter.ai/${m.id}`}
                        target="_blank"
                        rel="noreferrer"
                        title={`Open ${m.id} on OpenRouter`}
                      >
                        {m.name}
                        <svg
                          className="ext"
                          viewBox="0 0 16 16"
                          width="12"
                          height="12"
                          aria-hidden="true"
                        >
                          <path
                            fill="currentColor"
                            d="M11 2h3v3l-1.2-1.2-3.4 3.4-1-1 3.4-3.4L11 2zM4 3h4v1.5H4v7h7V8H12.5v4A1.5 1.5 0 0 1 11 13.5H4A1.5 1.5 0 0 1 2.5 12V4A1.5 1.5 0 0 1 4 2.5h4V4H4V3z"
                          />
                        </svg>
                      </a>
                      <span
                        className="modality"
                        title={m.modality || 'Unknown I/O modalities'}
                      >
                        {m.modality || '—'}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          '--hue': providerHue(m.provider),
                        }}
                      >
                        {m.provider}
                      </span>
                    </td>
                    <td className="num dim">{formatContext(m.contextLength)}</td>
                    <td className="num">
                      <span className="price">{formatPrice(m.inputPrice, unit)}</span>
                      {m.inputPrice > 0 && (
                        <span className="bar-track">
                          <span
                            className="bar"
                            style={{
                              width: `${Math.min((m.inputPrice / maxPrice) * 100, 100)}%`,
                            }}
                          />
                        </span>
                      )}
                    </td>
                    <td className="num">
                      <span className="price">{formatPrice(m.outputPrice, unit)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {visible.length === 0 && !loading && (
              <div className="empty">
                No models match your filters — try clearing the search.
              </div>
            )}
          </div>
        )}

        {!loading && visible.length > 0 && (
          <p className="count-line">
            Showing {visible.length.toLocaleString()} of {models.length.toLocaleString()} models
            {provider !== 'all' ? ` · ${provider}` : ''}
            {minContext ? ` · ${formatContext(minContext)}+ context` : ''}
          </p>
        )}

        <footer className="foot">
          <p>
            Prices sourced live from{' '}
            <a href="https://openrouter.ai" target="_blank" rel="noreferrer">
              OpenRouter's public model catalog
            </a>{' '}
            at page load — the most complete, always-current view of per-token
            rates across all major LM providers. No API key needed. Rates are
            list prices in USD and may vary by usage tier or region.
          </p>
          <p className="copyright">© MMXXVI Michael O'Sullivan</p>
        </footer>
      </main>
    </div>
  )
}
