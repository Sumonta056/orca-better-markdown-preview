import {
  Annotation,
  EditorState,
  EditorView,
  HighlightStyle,
  defaultKeymap,
  drawSelection,
  history,
  historyKeymap,
  indentWithTab,
  keymap,
  markdown,
  markdownKeymap,
  markdownLanguage,
  syntaxHighlighting,
  tags
} from '../lib/codemirror.mjs'
import { livePreview, refresh } from './live'
import { changedRegion, mergeText } from './merge'

const ZOOM_KEY = 'reader.zoom'
const ZOOM_MIN = 0.6
const ZOOM_MAX = 2.4
const ZOOM_STEP = 0.1

const fromOrca = Annotation.define<boolean>()

const markdownStyle = HighlightStyle.define([
  { tag: tags.processingInstruction, color: 'var(--muted)' },
  { tag: tags.meta, color: 'var(--muted)' },
  { tag: tags.url, color: 'var(--blue)' },
  { tag: tags.contentSeparator, color: 'var(--muted)' },
  { tag: tags.quote, color: 'var(--quote-fg)' }
])

const editorTheme = EditorView.theme({
  '.cm-content': { padding: '0 0 40vh', caretColor: 'var(--pink)' },
  '.cm-line': { padding: '0' },
  '.cm-cursor, .cm-dropCursor': { borderLeft: '2px solid var(--pink)', marginLeft: '-1px' }
})

const root = document.getElementById('doc') as HTMLElement
const doc = await orca.document.session<string>({ merge: mergeText })

const view = new EditorView({
  parent: root,
  state: EditorState.create({
    doc: doc.value,
    extensions: [
      history(),
      drawSelection(),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage }),
      keymap.of([...markdownKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
      syntaxHighlighting(markdownStyle),
      editorTheme,
      livePreview,
      EditorState.readOnly.of(doc.readOnly),
      EditorView.editable.of(!doc.readOnly),
      EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'off', autocapitalize: 'off' }),
      EditorView.updateListener.of((update: any) => {
        if (update.docChanged && !update.transactions.some((tr: any) => tr.annotation(fromOrca))) {
          doc.change(update.state.doc.toString())
        }
      }),
      EditorView.domEventHandlers({
        mousedown(event: MouseEvent) {
          if (!(event.metaKey || event.ctrlKey)) return false
          const url = (event.target as HTMLElement).closest('[data-url]')?.getAttribute('data-url') ?? ''
          if (!/^(https?|mailto):/i.test(url)) return false
          event.preventDefault()
          orca.shell.openExternal(url)
          return true
        }
      })
    ]
  })
})

doc.onReplace((value: string) => {
  const current = view.state.doc.toString()
  if (value === current) return
  const region = changedRegion(current, value)
  view.dispatch({
    changes: { from: region.start, to: region.baseEnd, insert: value.slice(region.start, region.textEnd) },
    annotations: fromOrca.of(true)
  })
})

orca.on('theme', () => view.dispatch({ effects: refresh.of(null) }))

const control = document.createElement('div')
control.className = 'zoom-control'
control.innerHTML =
  '<button type="button" data-zoom="out" aria-label="Zoom out">−</button>' +
  '<button type="button" data-zoom="reset" class="zoom-value" aria-label="Reset zoom">100%</button>' +
  '<button type="button" data-zoom="in" aria-label="Zoom in">+</button>'
document.body.append(control)
const label = control.querySelector('.zoom-value') as HTMLElement

function readZoom(): number {
  try {
    const saved = Number(localStorage.getItem(ZOOM_KEY))
    return saved >= ZOOM_MIN && saved <= ZOOM_MAX ? saved : 1
  } catch {
    return 1
  }
}

let zoom = readZoom()

function applyZoom(next: number) {
  zoom = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)) * 100) / 100
  document.documentElement.style.setProperty('--zoom', String(zoom))
  label.textContent = `${Math.round(zoom * 100)}%`
  try {
    localStorage.setItem(ZOOM_KEY, String(zoom))
  } catch {}
  view.requestMeasure()
}

applyZoom(zoom)

control.addEventListener('mousedown', (event) => event.preventDefault())
control.addEventListener('click', (event) => {
  const action = (event.target as HTMLElement).closest('button')?.dataset.zoom
  if (action === 'in') applyZoom(zoom + ZOOM_STEP)
  else if (action === 'out') applyZoom(zoom - ZOOM_STEP)
  else if (action === 'reset') applyZoom(1)
})

window.addEventListener(
  'keydown',
  (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return
    if (event.key === '=' || event.key === '+') applyZoom(zoom + ZOOM_STEP)
    else if (event.key === '-' || event.key === '_') applyZoom(zoom - ZOOM_STEP)
    else if (event.key === '0') applyZoom(1)
    else return
    event.preventDefault()
    event.stopPropagation()
  },
  { capture: true }
)

window.addEventListener(
  'wheel',
  (event) => {
    if (!event.ctrlKey) return
    event.preventDefault()
    applyZoom(zoom * Math.exp(-event.deltaY / 300))
  },
  { passive: false }
)
