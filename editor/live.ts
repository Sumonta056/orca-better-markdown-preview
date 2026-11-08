import { Decoration, EditorView, StateEffect, StateField, WidgetType, ensureSyntaxTree, syntaxTree } from '../lib/codemirror.mjs'
import { cachedDiagram, renderCode, renderDiagram, renderFrontMatter, renderTable } from './render'

const CALLOUTS: Record<string, { label: string; icon: string }> = {
  note: { label: 'Note', icon: 'ℹ' },
  tip: { label: 'Tip', icon: '✦' },
  important: { label: 'Important', icon: '❖' },
  warning: { label: 'Warning', icon: '▲' },
  caution: { label: 'Caution', icon: '⬢' }
}

const BULLETS = ['●', '◆', '▶', '–']

export const setFocused = StateEffect.define<boolean>()
export const refresh = StateEffect.define<null>()

function focusAt(view: any, dom: HTMLElement) {
  view.dispatch({ selection: { anchor: view.posAtDOM(dom) } })
  view.focus()
}

class BlockWidget extends WidgetType {
  constructor(readonly html: string, readonly kind: string) {
    super()
  }
  eq(other: BlockWidget) {
    return other.html === this.html
  }
  toDOM(view: any) {
    const dom = document.createElement('div')
    dom.className = `cm-block cm-block-${this.kind}`
    dom.innerHTML = this.html
    dom.addEventListener('mousedown', (event) => {
      const copy = (event.target as HTMLElement).closest('button.copy')
      event.preventDefault()
      if (!copy) return focusAt(view, dom)
      const code = dom.querySelector('code')?.textContent ?? ''
      navigator.clipboard.writeText(code).then(() => {
        copy.textContent = 'Copied'
        setTimeout(() => (copy.textContent = 'Copy'), 1200)
      })
    })
    return dom
  }
}

class DiagramWidget extends WidgetType {
  constructor(readonly source: string, readonly theme: string) {
    super()
  }
  eq(other: DiagramWidget) {
    return other.source === this.source && other.theme === this.theme
  }
  toDOM(view: any) {
    const dom = document.createElement('div')
    dom.className = 'cm-block cm-block-diagram'
    const ready = cachedDiagram(this.source)
    if (ready) dom.innerHTML = ready
    else {
      dom.textContent = 'Drawing diagram…'
      renderDiagram(this.source).then((svg) => {
        dom.innerHTML = svg
        view.requestMeasure()
      })
    }
    dom.addEventListener('mousedown', (event) => {
      event.preventDefault()
      focusAt(view, dom)
    })
    return dom
  }
}

class BulletWidget extends WidgetType {
  constructor(readonly depth: number) {
    super()
  }
  eq(other: BulletWidget) {
    return other.depth === this.depth
  }
  toDOM() {
    const dom = document.createElement('span')
    dom.className = `cm-bullet cm-bullet-${this.depth % BULLETS.length}`
    dom.textContent = BULLETS[this.depth % BULLETS.length]
    return dom
  }
}

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super()
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked
  }
  toDOM(view: any) {
    const dom = document.createElement('span')
    dom.className = this.checked ? 'cm-task-box done' : 'cm-task-box'
    dom.addEventListener('mousedown', (event) => {
      event.preventDefault()
      if (view.state.readOnly) return
      const pos = view.posAtDOM(dom)
      view.dispatch({ changes: { from: pos + 1, to: pos + 2, insert: this.checked ? ' ' : 'x' } })
    })
    return dom
  }
}

class CalloutTitleWidget extends WidgetType {
  constructor(readonly kind: string) {
    super()
  }
  eq(other: CalloutTitleWidget) {
    return other.kind === this.kind
  }
  toDOM() {
    const dom = document.createElement('span')
    const callout = CALLOUTS[this.kind]
    dom.className = 'cm-callout-title'
    dom.innerHTML = `<span class="cm-callout-icon">${callout.icon}</span>${callout.label}`
    return dom
  }
}

class RuleWidget extends WidgetType {
  eq() {
    return true
  }
  toDOM() {
    const dom = document.createElement('span')
    dom.className = 'cm-rule'
    return dom
  }
}

const hidden = Decoration.replace({})
const mark = (cls: string, attributes?: Record<string, string>) => Decoration.mark({ class: cls, attributes })
const line = (cls: string) => Decoration.line({ class: cls })

function frontMatterEnd(text: string): number {
  const match = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?=\r?\n|$)/.exec(text)
  return match ? match[0].length : -1
}

function build(state: any, focused: boolean) {
  const doc = state.doc
  const out: any[] = []
  const tree = ensureSyntaxTree(state, doc.length, 400) ?? syntaxTree(state)
  const ranges = focused ? state.selection.ranges : []
  const touches = (from: number, to: number) => ranges.some((r: any) => r.from <= to && r.to >= from)
  const activeLines = new Set<number>()
  for (const r of ranges) {
    for (let n = doc.lineAt(r.from).number; n <= doc.lineAt(r.to).number; n++) activeLines.add(n)
  }
  const lineActive = (pos: number) => activeLines.has(doc.lineAt(pos).number)
  const hide = (from: number, to: number) => {
    const next = to < doc.length && doc.sliceString(to, to + 1) === ' ' ? to + 1 : to
    if (next > from) out.push(hidden.range(from, next))
  }
  const eachLine = (from: number, to: number, cls: (index: number, last: boolean) => string) => {
    const first = doc.lineAt(from).number
    const last = doc.lineAt(to).number
    for (let n = first; n <= last; n++) out.push(line(cls(n - first, n === last)).range(doc.line(n).from))
  }
  const verbatim: [number, number][] = []
  const block = (from: number, to: number, widget: WidgetType) => {
    out.push(Decoration.replace({ widget, block: true }).range(doc.lineAt(from).from, doc.lineAt(to).to))
  }

  const fmEnd = frontMatterEnd(doc.sliceString(0, Math.min(doc.length, 20000)))
  if (fmEnd > 0) {
    if (touches(0, fmEnd)) eachLine(0, fmEnd, () => 'cm-code-line cm-fm-line')
    else block(0, fmEnd, new BlockWidget(renderFrontMatter(doc.sliceString(0, fmEnd).split(/\r?\n/).slice(1, -1).join('\n')), 'fm'))
  }

  tree.iterate({
    enter(ref: any) {
      const { name, from, to } = ref
      if (fmEnd > 0 && to <= fmEnd) return false
      const node = ref.node
      const heading = /^ATXHeading(\d)$/.exec(name)
      if (heading) {
        out.push(line(`cm-h cm-h${heading[1]}`).range(doc.lineAt(from).from))
        if (!lineActive(from)) for (const m of node.getChildren('HeaderMark')) hide(m.from, m.to)
        return
      }
      switch (name) {
        case 'Emphasis':
        case 'StrongEmphasis':
        case 'Strikethrough': {
          const cls = name === 'Emphasis' ? 'cm-em' : name === 'StrongEmphasis' ? 'cm-strong' : 'cm-strike'
          out.push(mark(cls).range(from, to))
          if (!touches(from, to)) {
            for (const m of node.getChildren(name === 'Strikethrough' ? 'StrikethroughMark' : 'EmphasisMark')) out.push(hidden.range(m.from, m.to))
          }
          return
        }
        case 'InlineCode': {
          out.push(mark('cm-inline-code').range(from, to))
          if (!touches(from, to)) for (const m of node.getChildren('CodeMark')) out.push(hidden.range(m.from, m.to))
          return false
        }
        case 'Link': {
          const marks = node.getChildren('LinkMark')
          const url = node.getChild('URL')
          if (marks.length < 2 || !url) return
          const href = doc.sliceString(url.from, url.to)
          if (marks[1].from > marks[0].to) out.push(mark('cm-link', { 'data-url': href }).range(marks[0].to, marks[1].from))
          if (!touches(from, to)) {
            out.push(hidden.range(from, marks[0].to))
            out.push(hidden.range(marks[1].from, to))
          }
          return false
        }
        case 'URL':
        case 'Autolink': {
          const href = doc.sliceString(from, to).replace(/^<|>$/g, '')
          out.push(mark('cm-link', { 'data-url': href }).range(from, to))
          return false
        }
        case 'Blockquote': {
          const first = doc.lineAt(from)
          const callout = /^\s*>\s*\[!(\w+)\]/.exec(first.text)
          const kind = callout?.[1].toLowerCase()
          if (kind && CALLOUTS[kind]) {
            eachLine(from, to, (i, last) => `cm-callout cm-callout-${kind}${i === 0 ? ' cm-callout-first' : ''}${last ? ' cm-callout-last' : ''}`)
            if (!lineActive(from)) {
              const start = first.from + first.text.indexOf('[!')
              const end = first.from + first.text.indexOf(']', start - first.from) + 1
              out.push(Decoration.replace({ widget: new CalloutTitleWidget(kind) }).range(start, end))
            }
          } else eachLine(from, to, (i, last) => `cm-quote${i === 0 ? ' cm-quote-first' : ''}${last ? ' cm-quote-last' : ''}`)
          return
        }
        case 'QuoteMark': {
          if (!lineActive(from)) hide(from, to)
          return
        }
        case 'ListMark': {
          const item = node.parent
          const list = item?.parent
          let depth = 0
          for (let p = list?.parent; p; p = p.parent) if (p.name === 'BulletList' || p.name === 'OrderedList') depth++
          const task = item?.getChild('Task')
          if (lineActive(from)) return
          if (task) hide(from, to)
          else if (list?.name === 'BulletList') out.push(Decoration.replace({ widget: new BulletWidget(depth) }).range(from, to))
          else out.push(mark(`cm-ol-mark cm-ol-mark-${depth % 2}`).range(from, to))
          return
        }
        case 'TaskMarker': {
          const checked = /x/i.test(doc.sliceString(from, to))
          const end = doc.lineAt(from).to
          if (checked && end > to) out.push(mark('cm-task-done').range(to, end))
          if (!lineActive(from)) out.push(Decoration.replace({ widget: new CheckboxWidget(checked) }).range(from, to))
          return
        }
        case 'HorizontalRule': {
          if (!lineActive(from)) out.push(Decoration.replace({ widget: new RuleWidget() }).range(from, to))
          return false
        }
        case 'FencedCode': {
          const info = node.getChild('CodeInfo')
          const text = node.getChild('CodeText')
          const lang = info ? doc.sliceString(info.from, info.to).trim().split(/\s+/)[0].toLowerCase() : ''
          const code = text ? doc.sliceString(text.from, text.to) : ''
          verbatim.push([from, to])
          if (touches(from, to)) eachLine(from, to, (i, last) => `cm-code-line${i === 0 ? ' cm-code-first' : ''}${last ? ' cm-code-last' : ''}`)
          else if (lang === 'mermaid') block(from, to, new DiagramWidget(code, document.documentElement.className))
          else block(from, to, new BlockWidget(renderCode(lang, code), 'code'))
          return false
        }
        case 'CodeBlock': {
          verbatim.push([from, to])
          eachLine(from, to, (i, last) => `cm-code-line${i === 0 ? ' cm-code-first' : ''}${last ? ' cm-code-last' : ''}`)
          return false
        }
        case 'Table': {
          if (touches(from, to)) eachLine(from, to, () => 'cm-code-line cm-table-line')
          else block(from, to, new BlockWidget(renderTable(doc.sliceString(from, to)), 'table'))
          return false
        }
      }
    }
  })

  for (let n = 1; n <= doc.lines; n++) {
    const current = doc.line(n)
    if (current.length && current.text.trim()) continue
    if (activeLines.has(n) || current.from < fmEnd) continue
    if (verbatim.some(([from, to]) => current.from > from && current.from < to)) continue
    out.push(line('cm-blank').range(current.from))
  }
  return Decoration.set(out, true)
}

const focusField = StateField.define<boolean>({
  create: () => false,
  update(value: boolean, tr: any) {
    for (const effect of tr.effects) if (effect.is(setFocused)) return effect.value
    return value
  }
})

const decorations = StateField.define<any>({
  create: (state: any) => build(state, false),
  update(value: any, tr: any) {
    const changed =
      tr.docChanged ||
      tr.selection ||
      tr.effects.some((e: any) => e.is(setFocused) || e.is(refresh)) ||
      syntaxTree(tr.state) !== syntaxTree(tr.startState)
    return changed ? build(tr.state, tr.state.field(focusField)) : value
  },
  provide: (field: any) => EditorView.decorations.from(field)
})

export const livePreview = [
  focusField,
  decorations,
  EditorView.focusChangeEffect.of((_state: any, focusing: boolean) => setFocused.of(focusing))
]
