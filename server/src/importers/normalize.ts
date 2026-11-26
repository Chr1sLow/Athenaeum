// Shared helpers that turn source markup into the reader's normalized Block[] shape.
import type { Block } from '@athenaeum/shared';
import { decodeHTML } from 'entities';
import type { ImportedChapter } from './types.ts';

const WORD = /[\p{L}\p{N}]/u;

export function countWords(text: string): number {
  let n = 0;
  for (const token of text.split(/\s+/)) if (WORD.test(token)) n++;
  return n;
}

export function blockText(block: Block): string {
  return block.type === 'p' || block.type === 'h' || block.type === 'note' ? block.text : '';
}

export function hasText(blocks: Block[]): boolean {
  return blocks.some((b) => blockText(b).trim().length > 0);
}

/** Builds a chapter: leading headings are dropped (the reader shows the title itself). */
export function makeChapter(title: string, blocks: Block[]): ImportedChapter {
  let start = 0;
  while (start < blocks.length && blocks[start]!.type === 'h') start++;
  const body = blocks.slice(start);
  const wordCount = body.reduce((n, b) => n + countWords(blockText(b)), 0);
  return { title, blocks: body, wordCount, gallery: [] };
}

/** Collapses runs of whitespace (including non-breaking spaces) to single spaces. */
export function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const XML_ENTITIES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

/**
 * XHTML often uses HTML-only entities like &nbsp; that an XML parser leaves undecoded.
 * Rewrite them as numeric references first, so each entity is decoded exactly once.
 */
export function htmlEntitiesToNumeric(xml: string): string {
  return xml.replace(/&([a-zA-Z][a-zA-Z0-9]{1,31});/g, (match, name: string) => {
    if (XML_ENTITIES.has(name)) return match;
    const decoded = decodeHTML(match);
    if (decoded === match) return match;
    return [...decoded].map((ch) => `&#${ch.codePointAt(0)};`).join('');
  });
}

// ---------------------------------------------------------------------------------------------
// DOM → blocks

/** Minimal DOM surface we rely on (linkedom nodes satisfy it). */
interface DomNode {
  nodeType: number;
  nodeName: string;
  textContent: string | null;
  childNodes: ArrayLike<DomNode>;
  getAttribute?(name: string): string | null;
}

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

const SKIP = new Set(['script', 'style', 'head', 'title', 'noscript', 'template', 'object', 'iframe', 'math']);
const BLOCK = new Set([
  'p', 'div', 'section', 'article', 'aside', 'header', 'footer', 'main', 'body', 'html', 'nav',
  'blockquote', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'figure', 'figcaption', 'table', 'thead',
  'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'pre', 'center', 'address', 'hgroup', 'details', 'summary',
]);
const HEADING_LEVEL: Record<string, 2 | 3 | 4> = { h1: 2, h2: 2, h3: 3, h4: 4, h5: 4, h6: 4 };
/** Inline formatting the reader keeps. Everything else is unwrapped to its text. */
const KEEP_INLINE = new Set(['em', 'strong', 'i', 'b', 'sup', 'sub', 'small', 'u', 's']);

const tagOf = (n: DomNode) => n.nodeName.toLowerCase().replace(/^.*:/, '');

export interface BlockWalkOptions {
  /** Maps an <img src> to an image key, or null to drop the image. */
  resolveImage(src: string): string | null;
  /** Called for every element id, with the index of the block it falls in. */
  onAnchor?(id: string, blockIndex: number): void;
}

function containsBlock(node: DomNode): boolean {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType !== ELEMENT_NODE) continue;
    const tag = tagOf(child);
    if (BLOCK.has(tag) || tag in HEADING_LEVEL || tag === 'hr' || tag === 'img' || tag === 'image' || tag === 'svg') return true;
    if (containsBlock(child)) return true;
  }
  return false;
}

/** Serializes inline nodes to { text, html } using only the allowed formatting tags. */
function serializeInline(nodes: DomNode[]): { text: string; html: string } {
  let text = '';
  let html = '';
  const walk = (n: DomNode) => {
    if (n.nodeType === TEXT_NODE) {
      const t = n.textContent ?? '';
      text += t;
      html += escapeHtml(t);
      return;
    }
    if (n.nodeType !== ELEMENT_NODE) return;
    const tag = tagOf(n);
    if (SKIP.has(tag)) return;
    if (tag === 'br') {
      text += ' ';
      html += '<br>';
      return;
    }
    const keep = KEEP_INLINE.has(tag);
    if (keep) html += `<${tag}>`;
    for (const c of Array.from(n.childNodes)) walk(c);
    if (keep) html += `</${tag}>`;
  };
  nodes.forEach(walk);
  return {
    text: collapse(text),
    html: html
      .replace(/\s+/g, ' ')
      .replace(/\s*<br>\s*/g, '<br>')
      .replace(/^(?:\s|<br>)+|(?:\s|<br>)+$/g, ''),
  };
}

export function domToBlocks(root: DomNode, opts: BlockWalkOptions): Block[] {
  const blocks: Block[] = [];
  let inline: DomNode[] = [];

  const flush = () => {
    if (!inline.length) return;
    const { text, html } = serializeInline(inline);
    inline = [];
    if (!text) return;
    blocks.push(html === escapeHtml(text) ? { type: 'p', text } : { type: 'p', text, html });
  };

  const anchor = (el: DomNode) => {
    const id = el.getAttribute?.('id');
    if (id && opts.onAnchor) opts.onAnchor(id, blocks.length);
  };

  const image = (el: DomNode) => {
    const src = el.getAttribute?.('src') ?? el.getAttribute?.('xlink:href') ?? el.getAttribute?.('href');
    const key = src ? opts.resolveImage(src) : null;
    if (!key) return;
    const alt = el.getAttribute?.('alt')?.trim();
    blocks.push(alt ? { type: 'img', imageId: key, alt } : { type: 'img', imageId: key });
  };

  const visit = (node: DomNode) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === TEXT_NODE) {
        inline.push(child);
        continue;
      }
      if (child.nodeType !== ELEMENT_NODE) continue;
      const tag = tagOf(child);
      if (SKIP.has(tag)) continue;
      anchor(child);

      if (tag in HEADING_LEVEL) {
        flush();
        const text = collapse(child.textContent ?? '');
        if (text) blocks.push({ type: 'h', level: HEADING_LEVEL[tag]!, text });
      } else if (tag === 'hr') {
        flush();
        blocks.push({ type: 'hr' });
      } else if (tag === 'img' || tag === 'image') {
        flush();
        image(child);
      } else if (tag === 'br') {
        inline.push(child);
      } else if (BLOCK.has(tag) || tag === 'svg') {
        flush();
        visit(child);
        flush();
      } else if (containsBlock(child)) {
        // An inline element wrapping blocks or images (e.g. <a><img/></a>): walk into it.
        visit(child);
      } else {
        inline.push(child);
      }
    }
  };

  visit(root);
  flush();
  return blocks;
}
