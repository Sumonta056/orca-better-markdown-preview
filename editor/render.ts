declare const markdownit: (options: object) => any
declare const hljs: any
declare const mermaid: any

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const md = markdownit({ html: false, linkify: true, typographer: true })

export function renderTable(source: string): string {
  return `<div class="table-wrap">${md.render(source).trim()}</div>`
}

function highlight(code: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
  return hljs.highlightAuto(code).value
}

export function renderCode(lang: string, code: string): string {
  return (
    `<figure class="code"><figcaption><span>${escapeHtml(lang || 'text')}</span>` +
    `<button type="button" class="copy">Copy</button></figcaption>` +
    `<pre><code class="hljs">${highlight(code, lang)}</code></pre></figure>`
  )
}

export function renderFrontMatter(body: string): string {
  const rows: [string, string][] = []
  for (const line of body.split(/\r?\n/)) {
    const pair = /^([\w.-]+):\s*(.*)$/.exec(line)
    const item = /^\s+-\s+(.*)$/.exec(line)
    if (pair) rows.push([pair[1], pair[2].replace(/^["']|["']$/g, '')])
    else if (item && rows.length) {
      const last = rows[rows.length - 1]
      last[1] = last[1] ? `${last[1]}, ${item[1]}` : item[1]
    }
  }
  const cells = rows.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join('')
  return `<dl class="front-matter">${cells}</dl>`
}

let mermaidReady: Promise<void> | null = null
let mermaidCount = 0
const diagrams = new Map<string, string>()

function loadMermaid(): Promise<void> {
  mermaidReady ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '../lib/mermaid.min.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('mermaid failed to load'))
    document.head.append(script)
  })
  return mermaidReady
}

export function cachedDiagram(source: string): string | undefined {
  return diagrams.get(`${document.documentElement.className}\n${source}`)
}

export async function renderDiagram(source: string): Promise<string> {
  const key = `${document.documentElement.className}\n${source}`
  const cached = diagrams.get(key)
  if (cached) return cached
  await loadMermaid()
  const dark = !document.documentElement.classList.contains('light')
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default' })
  try {
    const { svg } = await mermaid.render(`mermaid-${++mermaidCount}`, source)
    diagrams.set(key, svg)
    return svg
  } catch (error) {
    return `<pre class="diagram-error">${escapeHtml(String((error as Error)?.message ?? error))}</pre>`
  }
}
