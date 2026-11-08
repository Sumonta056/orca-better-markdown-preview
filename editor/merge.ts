export type Region = { start: number; baseEnd: number; textEnd: number }

export function changedRegion(base: string, text: string): Region {
  let start = 0
  while (start < base.length && start < text.length && base[start] === text[start]) start++
  let baseEnd = base.length
  let textEnd = text.length
  while (baseEnd > start && textEnd > start && base[baseEnd - 1] === text[textEnd - 1]) {
    baseEnd--
    textEnd--
  }
  return { start, baseEnd, textEnd }
}

export function mergeText(base: string, outside: string, mine: string): string {
  if (mine === base || outside === mine) return outside
  if (outside === base) return mine
  const a = changedRegion(base, mine)
  const b = changedRegion(base, outside)
  const [first, firstText, second, secondText] = a.baseEnd <= b.start ? [a, mine, b, outside] : [b, outside, a, mine]
  if (first.baseEnd > second.start) return outside
  return (
    base.slice(0, first.start) +
    firstText.slice(first.start, first.textEnd) +
    base.slice(first.baseEnd, second.start) +
    secondText.slice(second.start, second.textEnd) +
    base.slice(second.baseEnd)
  )
}
