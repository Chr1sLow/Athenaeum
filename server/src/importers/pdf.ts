import { createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';
import type { Block } from '@athenaeum/shared';
import { OPS, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ImportError } from './errors.ts';
import { collapse, countWords, escapeHtml, hasText, makeChapter } from './normalize.ts';
import type { ImportedBook, ImportedChapter, ImportedImage } from './types.ts';

const pdfjsRoot = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
/** pdf.js wants data folders as forward-slash paths ending in '/', even on Windows. */
const pdfjsDir = (name: string) => `${join(pdfjsRoot, name).split(sep).join('/')}/`;

/** One visual line of text on a page. */
interface Line {
  page: number;
  text: string;
  /** The same text as escaped HTML, with note numbers as `<sup>`. */
  html: string;
  x: number;
  y: number;
  width: number;
  /** The size of the line's ordinary (not superscript) text. */
  size: number;
  /** Note numbers raised in this line ("7" in `dokkaebi⁷`). */
  marks: string[];
  /** Set when the line starts with a raised number, as a footnote at the foot of a page does. */
  noteLabel?: string;
}

/** A rebuilt paragraph (or heading line). */
interface Para {
  text: string;
  html: string;
  page: number;
  y: number;
  size: number;
  heading: boolean;
  firstOnPage: boolean;
  /** Note numbers cited in this paragraph. */
  marks: string[];
  /** Set on a footnote: its number. */
  note?: string;
  /** Set on an illustration: it goes to the chapter's gallery, not its text. */
  image?: Illustration;
}

/** Text a reader reads, as opposed to a footnote or an illustration riding along in the stream. */
const textual = (p: Para) => !p.note && !p.image;

/** A footnote lifted from the foot of a page. */
interface Note {
  page: number;
  label: string;
  text: string;
  html: string;
}

const CHAPTER_RE =
  /^(chapter|ch\.|part|book|prologue|epilogue|interlude|afterword|foreword|preface|introduction|appendix)\b/i;
const PAGE_NUMBER_RE = /^(page\s+)?([\divxlc]+)(\s+of\s+\d+)?$/i;
/** Closing brackets include the CJK ones translated novels use to box quotes and system messages. */
const SENTENCE_END_RE = /[.!?:;"'”’)\]」』】〉》）]$/;
const SECTION_WORDS = 3000;

/** Opening → closing bracket for the "boxes" that set off quotes, messages and titles. */
const BOX_BRACKETS: Record<string, string> = { '「': '」', '『': '』', '【': '】', '[': ']', '〈': '〉', '《': '》' };

export const endsSentence = (text: string) => SENTENCE_END_RE.test(text);

/**
 * True when a paragraph that opened with a box bracket ("「…", "[…") has just closed it. Such a
 * box stands on its own line in print, so the paragraph ends there even with no space after it.
 */
export function closesBracketBlock(first: string, last: string): boolean {
  const close = BOX_BRACKETS[first.charAt(0)];
  return !!close && last.endsWith(close);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))]!;
}

function titleFromFilename(filename: string): string {
  return collapse(filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')) || 'Untitled';
}

type PdfDoc = Awaited<ReturnType<typeof getDocument>['promise']>;
type TextItem = { str: string; transform: number[]; width: number; height: number };
type Row = { y: number; items: TextItem[] };

const itemSize = (it: TextItem) => Math.abs(it.transform[3]!) || it.height;
const rowSize = (row: Row) => Math.max(...row.items.map(itemSize));
/** What a note number looks like: 7, 12, a, iv, *, †. */
const NOTE_LABEL_RE = /^(\d{1,3}|[a-z]{1,4}|[*†‡§¶]{1,3})$/i;

/**
 * A note number is set in small type a few points above the line it belongs to, so grouping by
 * baseline puts it in a row of its own (and the reader would show "7" on a line before the
 * sentence). Fold each such row back into the line just below it, and return the folded items.
 */
function foldRaisedRows(rows: Row[]): Set<TextItem> {
  const raised = new Set<TextItem>();
  for (const row of [...rows]) {
    const size = rowSize(row);
    const host = rows.find((h) => h !== row && size < rowSize(h) * 0.8 && row.y > h.y && row.y - h.y <= rowSize(h) * 0.6);
    if (!host || !row.items.every((it) => NOTE_LABEL_RE.test(it.str.trim()))) continue;
    host.items.push(...row.items);
    for (const it of row.items) raised.add(it);
    rows.splice(rows.indexOf(row), 1);
  }
  return raised;
}

async function pageLines(doc: PdfDoc, pageIndex: number): Promise<Line[]> {
  const page = await doc.getPage(pageIndex + 1);
  const content = await page.getTextContent();
  const items = (content.items as TextItem[]).filter((it) => typeof it.str === 'string' && it.str.trim());

  // Group text items into lines by baseline.
  const rows: Row[] = [];
  for (const it of items) {
    const y = it.transform[5]!;
    const row = rows.find((r) => Math.abs(r.y - y) <= Math.max(2, itemSize(it) * 0.25));
    if (row) row.items.push(it);
    else rows.push({ y, items: [it] });
  }
  const raised = foldRaisedRows(rows);

  return rows
    .map((row): Line => {
      row.items.sort((a, b) => a.transform[4]! - b.transform[4]!);
      let text = '';
      let html = '';
      let right = -Infinity;
      const marks: string[] = [];
      for (const it of row.items) {
        const x = it.transform[4]!;
        const sup = raised.has(it);
        // A note number hangs on the word before it, so never put a space in front of one.
        if (!sup && text && x - right > itemSize(it) * 0.15 && !text.endsWith(' ') && !it.str.startsWith(' ')) {
          text += ' ';
          html += ' ';
        }
        if (sup) {
          const label = it.str.trim();
          marks.push(label);
          text += label;
          html += `<sup>${escapeHtml(label)}</sup>`;
        } else {
          text += it.str;
          html += escapeHtml(it.str);
        }
        right = Math.max(right, x + it.width);
      }
      const first = row.items[0]!;
      const plain = row.items.filter((it) => !raised.has(it));
      const x = first.transform[4]!;
      return {
        page: pageIndex,
        text: collapse(text),
        html: collapse(html),
        x,
        y: row.y,
        width: right - x,
        size: Math.max(...(plain.length ? plain : row.items).map(itemSize)),
        marks,
        noteLabel: raised.has(first) && plain.length ? first.str.trim() : undefined,
      };
    })
    .filter((l) => l.text)
    .sort((a, b) => b.y - a.y);
}

/** Adds a line to running text, rejoining a word hyphenated across the break. */
function appendLine(acc: { text: string; html: string }, line: { text: string; html: string }) {
  if (!acc.text) {
    acc.text = line.text;
    acc.html = line.html;
  } else if (/\p{L}-$/u.test(acc.text) && acc.html.endsWith('-')) {
    const rejoin = /^\p{Ll}/u.test(line.text);
    acc.text = (rejoin ? acc.text.slice(0, -1) : acc.text) + line.text;
    acc.html = (rejoin ? acc.html.slice(0, -1) : acc.html) + line.html;
  } else {
    acc.text += ` ${line.text}`;
    acc.html += ` ${line.html}`;
  }
}

/**
 * Lifts footnotes off the foot of each page: the run of small-type lines at the bottom, starting
 * at one that begins with a raised number. Lines after a numbered one continue that note.
 * Small type without a number (a credit line) stays in the text.
 */
function extractFootnotes(pages: Line[][], bodySize: number): { pages: Line[][]; notes: Note[] } {
  const notes: Note[] = [];
  const small = (l: Line) => l.size < bodySize * 0.95;
  const withoutNotes = pages.map((lines, page) => {
    let start = lines.length;
    for (let i = lines.length - 1; i >= 0 && small(lines[i]!); i--) if (lines[i]!.noteLabel) start = i;
    let current: Note | null = null;
    for (const line of lines.slice(start)) {
      if (line.noteLabel) {
        const label = line.noteLabel;
        current = {
          page,
          label,
          text: collapse(line.text.slice(label.length)),
          html: collapse(line.html.replace(/^<sup>[^<]*<\/sup>/, '')),
        };
        notes.push(current);
      } else {
        appendLine(current!, line);
      }
    }
    return lines.slice(0, start);
  });
  return { pages: withoutNotes, notes };
}

/**
 * Puts each note into the paragraph stream right after the paragraph that cites it (or after
 * its page's last paragraph), so chapter splitting gives it to the chapter its number is in.
 * `parasToBlocks` then moves a chapter's notes to its end.
 */
function placeNotes(paras: Para[], notes: Note[]): Para[] {
  const after = new Map<number, Para[]>();
  for (const n of notes) {
    // The citing paragraph may have started on an earlier page, so take the nearest one up to this page.
    // (Numbers can restart in each chapter; the nearest is the right one.)
    let at = paras.findLastIndex((p) => p.page <= n.page && p.page >= n.page - 1 && p.marks.includes(n.label));
    if (at === -1) at = paras.findLastIndex((p) => textual(p) && p.page <= n.page);
    const anchor = paras[at];
    const note: Para = {
      text: n.text,
      html: n.html,
      page: anchor?.page ?? n.page,
      y: anchor?.y ?? 0,
      size: anchor?.size ?? 0,
      heading: false,
      firstOnPage: false,
      marks: [],
      note: n.label,
    };
    after.set(at, [...(after.get(at) ?? []), note]);
  }
  return [...(after.get(-1) ?? []), ...paras.flatMap((p, i) => [p, ...(after.get(i) ?? [])])];
}

/** Removes page numbers and running headers/footers. */
function stripPageFurniture(pages: Line[][], bodySize: number): Line[][] {
  const gaps = pages.flatMap((lines) => lines.slice(1).map((l, i) => lines[i]!.y - l.y)).filter((g) => g > 0);
  const lineGap = median(gaps) || bodySize * 1.4;

  // Headers and footers are set apart from the text: smaller type, or extra space between them.
  const setApart = (lines: Line[], l: Line) => {
    if (l.size < bodySize * 0.95) return true;
    const i = lines.indexOf(l);
    const neighbor = i < lines.length / 2 ? lines[i + 1] : lines[i - 1];
    return !neighbor || Math.abs(neighbor.y - l.y) > lineGap * 1.5;
  };
  const edge = (lines: Line[]) => [...new Set([...lines.slice(0, 2), ...lines.slice(-2)])].filter((l) => setApart(lines, l));
  const norm = (t: string) => t.toLowerCase().replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  const isCandidate = (l: Line) => l.size <= bodySize * 1.05 && !CHAPTER_RE.test(l.text) && l.text.length <= 80;

  const counts = new Map<string, number>();
  for (const lines of pages) {
    const seen = new Set(edge(lines).filter(isCandidate).map((l) => norm(l.text)));
    for (const key of seen) if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const minRepeats = Math.max(3, Math.ceil(pages.length * 0.3));
  const running = new Set([...counts].filter(([, n]) => n >= minRepeats).map(([k]) => k));

  return pages.map((lines) => {
    const first = lines[0];
    const last = lines[lines.length - 1];
    const edges = edge(lines);
    return lines.filter((l) => {
      const atEdge = l === first || l === last;
      if (atEdge && PAGE_NUMBER_RE.test(l.text) && l.size <= bodySize * 1.05) return false;
      if (edges.includes(l) && isCandidate(l) && running.has(norm(l.text))) return false;
      return true;
    });
  });
}

/**
 * The distance between wrapped lines of one paragraph: the smallest gap that is common. Not the
 * median: in a novel told in short paragraphs most gaps are the bigger space *between* paragraphs,
 * and measured against that, no paragraph break would ever stand out.
 */
function lineSpacing(gaps: number[], bodySize: number): number {
  const counts = new Map<number, number>();
  for (const g of gaps) if (g >= bodySize * 0.8) counts.set(Math.round(g), (counts.get(Math.round(g)) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const common = [...counts].filter(([, n]) => n >= 2 && n >= total * 0.1).map(([g]) => g);
  return common.length ? Math.min(...common) : median(gaps) || bodySize * 1.4;
}

function buildParagraphs(pages: Line[][]): Para[] {
  const all = pages.flat();
  const charWeighted = all.flatMap((l) => Array<number>(Math.min(l.text.length, 200)).fill(Math.round(l.size * 2) / 2));
  const bodySize = median(charWeighted);
  const isHeadingSize = (l: Line) => l.size >= bodySize * 1.15;
  const body = all.filter((l) => !isHeadingSize(l));

  const gaps: number[] = [];
  for (const lines of pages) {
    for (let i = 1; i < lines.length; i++) {
      const a = lines[i - 1]!;
      const b = lines[i]!;
      if (!isHeadingSize(a) && !isHeadingSize(b) && a.y > b.y) gaps.push(a.y - b.y);
    }
  }
  const lineGap = lineSpacing(gaps, bodySize);
  const xCounts = new Map<number, number>();
  for (const l of body) xCounts.set(Math.round(l.x), (xCounts.get(Math.round(l.x)) ?? 0) + 1);
  const leftMargin = [...xCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const fullWidth = percentile(body.map((l) => l.width), 0.9);

  const paras: Para[] = [];
  let current: { lines: Line[] } | null = null;
  let prev: Line | null = null;

  const close = () => {
    if (!current) return;
    const lines = current.lines;
    const joined = { text: '', html: '' };
    for (const l of lines) appendLine(joined, l);
    const first = lines[0]!;
    const pageLines = pages[first.page]!;
    paras.push({
      text: collapse(joined.text),
      html: collapse(joined.html),
      marks: lines.flatMap((l) => l.marks),
      page: first.page,
      y: first.y,
      size: Math.max(...lines.map((l) => l.size)),
      heading: lines.every(isHeadingSize),
      firstOnPage: pageLines[0] === first,
    });
    current = null;
  };

  for (const line of all) {
    let startNew = !current || !prev;
    if (prev && current) {
      const samePage = prev.page === line.page;
      const indent = line.x - leftMargin;
      const prevShort = prev.width < fullWidth * 0.8 && SENTENCE_END_RE.test(prev.text);
      const boxClosed = closesBracketBlock(current.lines[0]!.text, prev.text);
      if (isHeadingSize(line) !== isHeadingSize(prev)) startNew = true;
      else if (boxClosed) startNew = true;
      else if (isHeadingSize(line) && isHeadingSize(prev)) startNew = true;
      else if (samePage && prev.y - line.y > lineGap * 1.4) startNew = true;
      else if (indent > bodySize * 0.8 && indent < bodySize * 8) startNew = true;
      else if (prevShort) startNew = true;
      else if (CHAPTER_RE.test(prev.text) && prev.text.length <= 40 && prev.width < fullWidth * 0.6) startNew = true;
    }
    if (startNew) {
      close();
      current = { lines: [] };
    }
    current!.lines.push(line);
    prev = line;
  }
  close();
  return paras;
}

function paraBlock(p: Para): Block {
  // `html` only when it says more than the text (a <sup> note number); it is built from escaped text.
  const html = p.html !== escapeHtml(p.text) ? { html: p.html } : {};
  if (p.note) return { type: 'note', label: p.note, text: p.text, ...html };
  if (p.heading) return { type: 'h', level: 2, text: p.text };
  return { type: 'p', text: p.text, ...html };
}

/** A chapter's blocks: its text, then its footnotes, the way a book prints endnotes. */
function parasToBlocks(paras: Para[]): Block[] {
  return [...paras.filter(textual), ...paras.filter((p) => p.note)].map(paraBlock);
}

/** A chapter from its slice of the stream: text, then notes, with illustrations in its gallery. */
function toChapter(title: string, paras: Para[]): ImportedChapter {
  const gallery = paras.flatMap((p) => (p.image ? [{ key: p.image.key, width: p.image.width, height: p.image.height }] : []));
  return { ...makeChapter(title, parasToBlocks(paras)), gallery };
}

function chunkIntoSections(paras: Para[], bookTitle: string): ImportedChapter[] {
  const sections: Para[][] = [];
  let current: Para[] = [];
  let words = 0;
  for (const p of paras) {
    current.push(p);
    words += countWords(p.text);
    if (words >= SECTION_WORDS) {
      sections.push(current);
      current = [];
      words = 0;
    }
  }
  if (current.length) sections.push(current);
  if (sections.length === 1) return [toChapter(bookTitle, sections[0]!)];
  return sections.map((s, i) => toChapter(`Section ${i + 1}`, s));
}

/** Splits paragraphs at the given start indexes, with anything before the first as Front Matter. */
function splitAt(paras: Para[], starts: { index: number; title: string }[]): ImportedChapter[] {
  const chapters: ImportedChapter[] = [];
  const first = starts[0]!.index;
  const front = paras.slice(0, first);
  // Without any text before the first chapter, whatever is there (a frontispiece) joins that chapter.
  const frontIsText = hasText(parasToBlocks(front));
  if (frontIsText) chapters.push(toChapter('Front Matter', front));
  starts.forEach((s, i) => {
    const from = i === 0 && !frontIsText ? 0 : s.index;
    chapters.push(toChapter(s.title, paras.slice(from, starts[i + 1]?.index ?? paras.length)));
  });
  return chapters.filter((c) => c.blocks.length > 0 || c.gallery.length > 0);
}

async function chaptersFromOutline(doc: PdfDoc, paras: Para[]): Promise<ImportedChapter[] | null> {
  const outline = await doc.getOutline().catch(() => null);
  if (!outline?.length) return null;
  type Node = { title: string; dest: unknown; items?: Node[] };
  const flat: Node[] = [];
  const walk = (nodes: Node[]) => nodes.forEach((n) => (flat.push(n), n.items && walk(n.items)));
  walk(outline as Node[]);

  const targets: { title: string; page: number; top: number | null }[] = [];
  for (const node of flat) {
    try {
      const dest = typeof node.dest === 'string' ? await doc.getDestination(node.dest) : (node.dest as unknown[] | null);
      if (!Array.isArray(dest) || !dest[0]) continue;
      const page = await doc.getPageIndex(dest[0] as never);
      const top = (dest[1] as { name?: string })?.name === 'XYZ' && typeof dest[3] === 'number' ? dest[3] : null;
      const title = collapse(node.title);
      if (title) targets.push({ title, page, top });
    } catch {
      /* unresolvable bookmark */
    }
  }
  if (targets.length < 2) return null;

  const starts: { index: number; title: string }[] = [];
  for (const t of targets) {
    const index = paras.findIndex(
      (p) => textual(p) && (p.page > t.page || (p.page === t.page && (t.top === null || p.y <= t.top + 2))),
    );
    if (index === -1) continue;
    const last = starts[starts.length - 1];
    if (last && last.index === index) last.title = t.title;
    else if (!last || index > last.index) starts.push({ index, title: t.title });
  }
  return starts.length ? splitAt(paras, starts) : null;
}

function chaptersFromHeadings(paras: Para[]): ImportedChapter[] | null {
  const starts: { index: number; title: string }[] = [];
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i]!;
    if (!textual(p)) continue;
    const short = p.text.length <= 80;
    const named = short && CHAPTER_RE.test(p.text);
    const bigAtTop = p.heading && short && p.firstOnPage;
    if (!named && !bigAtTop) continue;

    const index = i;
    let title = p.text;
    const next = paras[i + 1];
    // "Chapter 3" followed by its title line in the same large type → "Chapter 3: The Storm"
    // ("CHAPTER XI." + "Who Stole the Tarts?" → "CHAPTER XI. Who Stole the Tarts?")
    if (named && p.heading && next?.heading && next.text.length <= 60 && !next.text.endsWith('.') && !CHAPTER_RE.test(next.text)) {
      title = /[.:]$/.test(p.text) ? `${p.text} ${next.text}` : `${p.text}: ${next.text}`;
      i++;
    }
    starts.push({ index, title });
  }
  return starts.length ? splitAt(paras, dropTableOfContents(paras, starts)) : null;
}

/** A chapter needs at least this many words of text; fewer means its "heading" was a contents line. */
const MIN_CHAPTER_WORDS = 30;

/**
 * A contents page lists every chapter title, so it looks like a run of chapters with nothing in
 * them. Drop any start whose text before the next start is too short, keeping the last one.
 */
function dropTableOfContents(paras: Para[], starts: { index: number; title: string }[]) {
  return starts.filter((s, i) => {
    const next = starts[i + 1];
    if (!next) return true;
    const words = paras.slice(s.index + 1, next.index).reduce((n, p) => n + (p.heading || !textual(p) ? 0 : countWords(p.text)), 0);
    return words >= MIN_CHAPTER_WORDS;
  });
}

/** An embedded picture pulled out of the PDF, before it has a place in a chapter. */
interface Illustration {
  key: string;
  page: number;
  width: number;
  height: number;
}

/** Smaller pictures are ornaments, icons and scene-break flourishes, not illustrations. */
const MIN_IMAGE_SIDE = 150;
const MIN_IMAGE_AREA = 60_000;
/** Bigger pictures are scaled down to this on their long side. */
const MAX_IMAGE_SIDE = 2000;
/** A picture on this many pages or more is a logo or page decoration. */
const REPEATED_ON_PAGES = 3;

/** pdf.js pixel formats (`ImageKind`). */
const GRAYSCALE_1BPP = 1;
const RGB_24BPP = 2;
const RGBA_32BPP = 3;

type DecodedImage = { width: number; height: number; kind?: number; data?: Uint8Array | Uint8ClampedArray; ref?: string };
type ObjStore = { get(name: string, callback: (img: DecodedImage) => void): void };
type Canvas2d = {
  createImageData(w: number, h: number): { data: Uint8ClampedArray };
  putImageData(data: unknown, x: number, y: number): void;
  drawImage(image: unknown, x: number, y: number, w: number, h: number): void;
};
type CanvasFactory = {
  create(w: number, h: number): { canvas: { toBuffer(type: string, quality?: number): Buffer }; context: Canvas2d };
};

/** Decoded pixels as RGBA, whatever format pdf.js handed them over in. */
function toRgba(img: DecodedImage): Uint8ClampedArray | null {
  const { width, height, kind, data } = img;
  if (!data) return null;
  const n = width * height;
  if (kind === RGBA_32BPP) return new Uint8ClampedArray(data.buffer, data.byteOffset, n * 4);
  const out = new Uint8ClampedArray(n * 4);
  if (kind === RGB_24BPP) {
    for (let i = 0; i < n; i++) {
      out[i * 4] = data[i * 3]!;
      out[i * 4 + 1] = data[i * 3 + 1]!;
      out[i * 4 + 2] = data[i * 3 + 2]!;
      out[i * 4 + 3] = 255;
    }
    return out;
  }
  if (kind === GRAYSCALE_1BPP) {
    // One bit per pixel, rows padded to whole bytes; a set bit is white.
    const rowBytes = Math.ceil(width / 8);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = data[y * rowBytes + (x >> 3)]! & (0x80 >> (x & 7)) ? 255 : 0;
        out.set([v, v, v, 255], (y * width + x) * 4);
      }
    }
    return out;
  }
  return null;
}

/** Re-encodes decoded pixels as a JPEG, scaled down if they are very large. */
function encodeJpeg(factory: CanvasFactory, img: DecodedImage, rgba: Uint8ClampedArray): Buffer {
  const full = factory.create(img.width, img.height);
  const pixels = full.context.createImageData(img.width, img.height);
  pixels.data.set(rgba);
  full.context.putImageData(pixels, 0, 0);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
  if (scale === 1) return full.canvas.toBuffer('image/jpeg', 85);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const small = factory.create(w, h);
  small.context.drawImage(full.canvas, 0, 0, w, h);
  return small.canvas.toBuffer('image/jpeg', 85);
}

/**
 * The illustrations embedded in the PDF, in page order, as JPEGs. Skips ornaments too small to
 * be pictures and anything repeated on many pages (logos, page backgrounds).
 */
async function extractIllustrations(doc: PdfDoc): Promise<{ found: Illustration[]; images: ImportedImage[] }> {
  const factory = (doc as unknown as { canvasFactory: CanvasFactory }).canvasFactory;
  const uses: { page: number; name: string; objs: ObjStore }[] = [];
  for (let i = 0; i < doc.numPages; i++) {
    const page = await doc.getPage(i + 1);
    const ops = await page.getOperatorList();
    ops.fnArray.forEach((fn, j) => {
      if (fn !== OPS.paintImageXObject) return;
      const [name, w, h] = ops.argsArray[j] as [string, number, number];
      if (Math.min(w, h) < MIN_IMAGE_SIDE || w * h < MIN_IMAGE_AREA) return;
      // Images shared between pages live in commonObjs (their names start with "g_").
      const objs = (name.startsWith('g_') ? page.commonObjs : page.objs) as unknown as ObjStore;
      uses.push({ page: i, name, objs });
    });
  }

  const decoded = await Promise.all(uses.map((u) => new Promise<DecodedImage>((resolve) => u.objs.get(u.name, resolve))));
  const idOf = (i: number) => decoded[i]!.ref ?? uses[i]!.name;
  const pagesOf = new Map<string, Set<number>>();
  decoded.forEach((_, i) => pagesOf.set(idOf(i), (pagesOf.get(idOf(i)) ?? new Set()).add(uses[i]!.page)));

  const found: Illustration[] = [];
  const images: ImportedImage[] = [];
  const done = new Set<string>();
  for (const [i, img] of decoded.entries()) {
    const id = idOf(i);
    if (done.has(id) || pagesOf.get(id)!.size >= REPEATED_ON_PAGES) continue;
    done.add(id);
    const rgba = toRgba(img);
    if (!rgba) continue;
    const key = `pdf-image-${images.length}`;
    images.push({ key, mime: 'image/jpeg', data: encodeJpeg(factory, img, rgba) });
    found.push({ key, page: uses[i]!.page, width: img.width, height: img.height });
  }
  return { found, images };
}

/**
 * Puts each illustration into the stream after the last text on or before its page. Novels
 * print a chapter's pictures at its end, so they go to the chapter they follow.
 */
function placeIllustrations(paras: Para[], found: Illustration[]): Para[] {
  const after = new Map<number, Para[]>();
  for (const image of found) {
    const at = paras.findLastIndex((p) => textual(p) && p.page <= image.page);
    const anchor = paras[at];
    const para: Para = {
      text: '',
      html: '',
      page: anchor?.page ?? image.page,
      y: anchor?.y ?? 0,
      size: 0,
      heading: false,
      firstOnPage: false,
      marks: [],
      image,
    };
    after.set(at, [...(after.get(at) ?? []), para]);
  }
  return [...(after.get(-1) ?? []), ...paras.flatMap((p, i) => [p, ...(after.get(i) ?? [])])];
}

/** Page 1 as a JPEG: the cover for a PDF with no pictures. */
async function renderCover(doc: PdfDoc): Promise<{ mime: string; data: Buffer } | null> {
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2, 600 / base.width) });
    const factory = (doc as unknown as { canvasFactory: { create(w: number, h: number): { canvas: { toBuffer(t: string, q?: number): Buffer }; context: unknown } } }).canvasFactory;
    const { canvas, context } = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: context as never, viewport, canvas: canvas as never }).promise;
    return { mime: 'image/jpeg', data: canvas.toBuffer('image/jpeg', 82) };
  } catch {
    return null;
  }
}

export async function parsePdf(data: Buffer, filename: string): Promise<ImportedBook> {
  const task = getDocument({
    data: new Uint8Array(data),
    verbosity: 0,
    standardFontDataUrl: pdfjsDir('standard_fonts'),
    cMapUrl: pdfjsDir('cmaps'),
    cMapPacked: true,
  });
  let doc: PdfDoc;
  try {
    doc = await task.promise;
  } catch (err) {
    await task.destroy().catch(() => {});
    if ((err as { name?: string }).name === 'PasswordException') {
      throw new ImportError('This PDF is password-protected. Remove the password and try again.');
    }
    throw new ImportError("This PDF is damaged or isn't a valid PDF.");
  }

  try {
    const info = ((await doc.getMetadata().catch(() => null))?.info ?? {}) as { Title?: string; Author?: string };
    const title = collapse(info.Title ?? '') || titleFromFilename(filename);
    const author = collapse(info.Author ?? '') || null;

    const rawPages: Line[][] = [];
    for (let i = 0; i < doc.numPages; i++) rawPages.push(await pageLines(doc, i));
    const textChars = rawPages.flat().reduce((n, l) => n + l.text.length, 0);
    if (textChars < 20) {
      throw new ImportError("This PDF has no text layer (it may be a scan), so it can't be reflowed into a readable format.");
    }

    const bodySize = median(rawPages.flat().map((l) => l.size));
    // Page numbers go first, so a number under the footnotes isn't read as part of the last note.
    const { pages, notes } = extractFootnotes(stripPageFurniture(rawPages, bodySize), bodySize);
    const illustrations = await extractIllustrations(doc);
    const paras = placeIllustrations(placeNotes(buildParagraphs(pages), notes), illustrations.found);

    const chapters =
      (await chaptersFromOutline(doc, paras)) ?? chaptersFromHeadings(paras) ?? chunkIntoSections(paras, title);
    if (!chapters.some((c) => hasText(c.blocks))) throw new ImportError('This PDF has no readable text.');

    // The first picture in the book (illustrations are in page order) makes a cover that fills
    // the card; a render of page 1 would be the picture on a white page. No pictures: page 1.
    const first = illustrations.images[0];
    const cover = first ? { mime: first.mime, data: first.data } : await renderCover(doc);
    return { title, author, description: null, cover, chapters, images: illustrations.images };
  } finally {
    await task.destroy().catch(() => {});
  }
}
