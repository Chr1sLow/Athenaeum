import type { Block } from '@athenaeum/shared';
import JSZip from 'jszip';
import { DOMParser } from 'linkedom';
import { ImportError } from './errors.ts';
import { isDecoration } from './imageSize.ts';
import { collapse, domToBlocks, hasText, htmlEntitiesToNumeric, makeChapter } from './normalize.ts';
import type { ImportedBook, ImportedChapter, ImportedImage } from './types.ts';

type XmlDoc = ReturnType<DOMParser['parseFromString']>;
type El = { getAttribute(n: string): string | null; textContent: string | null; getElementsByTagName(n: string): ArrayLike<El> };

const NOT_EPUB = "This file doesn't look like an EPUB.";

function parseXml(text: string): XmlDoc {
  return new DOMParser().parseFromString(htmlEntitiesToNumeric(text), 'text/xml');
}

/** Elements by name, with or without a namespace prefix (some OPFs write <opf:item>). */
function tags(root: { getElementsByTagName(n: string): ArrayLike<El> }, name: string, prefixes: string[] = ['opf']): El[] {
  const found = Array.from(root.getElementsByTagName(name));
  for (const p of prefixes) found.push(...Array.from(root.getElementsByTagName(`${p}:${name}`)));
  return found;
}

/** Resolves `href` relative to the file at `base` (both zip paths), dropping any #fragment. */
function resolvePath(base: string, href: string): { path: string; fragment: string | null } {
  const [rawPath = '', fragment = null] = href.split('#') as [string, string?];
  let decoded = rawPath;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    /* keep raw */
  }
  const parts = decoded.startsWith('/') ? [] : base.split('/').slice(0, -1);
  for (const seg of decoded.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  return { path: parts.join('/'), fragment: fragment ?? null };
}

function stripHtml(text: string): string {
  const doc = new DOMParser().parseFromString(`<!doctype html><html><body><div>${text}</div></body></html>`, 'text/html');
  return collapse(doc.querySelector('div')?.textContent ?? text);
}

interface ManifestItem {
  path: string;
  mediaType: string;
  properties: string[];
}

interface TocTarget {
  label: string;
  path: string;
  fragment: string | null;
}

export async function parseEpub(data: Buffer): Promise<ImportedBook> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new ImportError("This file isn't a valid EPUB (it couldn't be unzipped).");
  }
  const read = async (path: string) => {
    const file = zip.file(path);
    return file ? file.async('string') : null;
  };

  // 1. Package document
  const container = await read('META-INF/container.xml');
  if (!container) throw new ImportError(NOT_EPUB);
  const opfPath = tags(parseXml(container), 'rootfile', [])[0]?.getAttribute('full-path');
  const opfText = opfPath ? await read(opfPath) : null;
  if (!opfPath || !opfText) throw new ImportError(NOT_EPUB);
  const opf = parseXml(opfText);

  const dc = (name: string) =>
    Array.from(opf.getElementsByTagName(`dc:${name}`) as ArrayLike<El>)
      .map((e) => collapse(e.textContent ?? ''))
      .filter(Boolean);
  const title = dc('title')[0] ?? 'Untitled';
  const author = dc('creator').join(', ') || null;
  const rawDescription = dc('description')[0];
  const description = rawDescription ? stripHtml(rawDescription) || null : null;

  // 2. Manifest and reading order
  const manifest = new Map<string, ManifestItem>();
  const byPath = new Map<string, ManifestItem>();
  for (const item of tags(opf, 'item')) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (!id || !href) continue;
    const entry: ManifestItem = {
      path: resolvePath(opfPath, href).path,
      mediaType: item.getAttribute('media-type') ?? '',
      properties: (item.getAttribute('properties') ?? '').split(/\s+/),
    };
    manifest.set(id, entry);
    byPath.set(entry.path, entry);
  }
  const spineEl = tags(opf, 'spine')[0];
  const spine = tags(opf, 'itemref')
    .filter((ref) => ref.getAttribute('linear') !== 'no')
    .map((ref) => manifest.get(ref.getAttribute('idref') ?? ''))
    .filter((m): m is ManifestItem => !!m && /html|xml/.test(m.mediaType));

  // 3. Cover
  const coverItem =
    [...manifest.values()].find((m) => m.properties.includes('cover-image')) ??
    manifest.get(tags(opf, 'meta').find((m) => m.getAttribute('name') === 'cover')?.getAttribute('content') ?? '') ??
    null;
  const coverData = coverItem?.mediaType.startsWith('image/') ? await zip.file(coverItem.path)?.async('nodebuffer') : undefined;
  let cover = coverItem && coverData ? { mime: coverItem.mediaType, data: coverData } : null;

  // 4. Table of contents (EPUB 3 nav, else EPUB 2 NCX), flattened in reading order
  const toc = await readToc(manifest, spineEl, read);

  // 5. Walk every spine document into one block stream, remembering where files and anchors start
  const stream: Block[] = [];
  const fileStart = new Map<string, number>();
  const anchors = new Map<string, number>();
  const docs: { path: string; start: number; end: number }[] = [];
  const imageKeys = new Map<string, string>(); // zip path → key

  for (const item of spine) {
    const text = await read(item.path);
    if (text === null) continue;
    const doc = parseXml(text);
    const body = (doc.getElementsByTagName('body')[0] ?? doc.documentElement) as unknown as Parameters<typeof domToBlocks>[0];
    const localAnchors: [string, number][] = [];
    const blocks = domToBlocks(body, {
      resolveImage: (src) => {
        const { path } = resolvePath(item.path, src);
        const target = byPath.get(path);
        if (!target?.mediaType.startsWith('image/')) return null;
        let key = imageKeys.get(path);
        if (!key) {
          key = `img${imageKeys.size}`;
          imageKeys.set(path, key);
        }
        return key;
      },
      onAnchor: (id, i) => localAnchors.push([id, i]),
    });

    // Skip pages with nothing to read: empty files and cover wrappers.
    const onlyCover = blocks.every((b) => b.type === 'img' && imageKeys.get(coverItem?.path ?? '') === b.imageId);
    if (!blocks.length || (!hasText(blocks) && onlyCover)) continue;

    const start = stream.length;
    fileStart.set(item.path, start);
    for (const [id, i] of localAnchors) anchors.set(`${item.path}#${id}`, start + i);
    stream.push(...blocks);
    docs.push({ path: item.path, start, end: stream.length });
  }

  // With no declared cover, the first real picture in reading order is the cover.
  cover ??= await firstPicture(zip, imageKeys.keys(), byPath);

  // 6. Cut the stream into chapters
  const boundaries = toc
    .map((t) => ({
      title: t.label,
      at: t.fragment ? (anchors.get(`${t.path}#${t.fragment}`) ?? fileStart.get(t.path)) : fileStart.get(t.path),
    }))
    .filter((b): b is { title: string; at: number } => b.at !== undefined)
    .sort((a, b) => a.at - b.at);

  let chapters: ImportedChapter[] = [];
  if (boundaries.length) {
    const first = boundaries[0]!.at;
    if (first > 0) chapters.push(makeChapter('Front Matter', stream.slice(0, first)));
    boundaries.forEach((b, i) => {
      chapters.push(makeChapter(b.title, stream.slice(b.at, boundaries[i + 1]?.at ?? stream.length)));
    });
  } else {
    chapters = docs.map((d, i) => {
      const blocks = stream.slice(d.start, d.end);
      const heading = blocks.find((b) => b.type === 'h') as { text: string } | undefined;
      return makeChapter(heading?.text ?? `Chapter ${i + 1}`, blocks);
    });
  }
  // A part title page or other heading-only section has nothing to read once its heading is dropped.
  chapters = chapters.filter((c) => c.blocks.some((b) => b.type === 'img' || (b.type === 'p' && b.text)));
  if (!chapters.length) throw new ImportError('This EPUB has no readable text.');

  // 7. Load the images that chapters actually use
  const used = new Set(chapters.flatMap((c) => c.blocks.flatMap((b) => (b.type === 'img' ? [b.imageId] : []))));
  const images: ImportedImage[] = [];
  for (const [path, key] of imageKeys) {
    if (!used.has(key)) continue;
    const bytes = await zip.file(path)?.async('nodebuffer');
    if (bytes) images.push({ key, mime: byPath.get(path)!.mediaType, data: bytes });
  }
  if (images.length !== used.size) {
    const have = new Set(images.map((i) => i.key));
    for (const c of chapters) c.blocks = c.blocks.filter((b) => b.type !== 'img' || have.has(b.imageId));
  }

  return { title, author, description, cover, chapters, images };
}

/** The first of `paths` (zip paths of images) that isn't a small ornament. */
async function firstPicture(
  zip: JSZip,
  paths: Iterable<string>,
  byPath: Map<string, ManifestItem>,
): Promise<{ mime: string; data: Buffer } | null> {
  for (const path of paths) {
    const data = await zip.file(path)?.async('nodebuffer');
    if (data && !isDecoration(data)) return { mime: byPath.get(path)!.mediaType, data };
  }
  return null;
}

async function readToc(
  manifest: Map<string, ManifestItem>,
  spineEl: El | undefined,
  read: (path: string) => Promise<string | null>,
): Promise<TocTarget[]> {
  const nav = [...manifest.values()].find((m) => m.properties.includes('nav'));
  if (nav) {
    const text = await read(nav.path);
    if (text) {
      const doc = parseXml(text);
      const navs = tags(doc, 'nav', []);
      const tocNav = navs.find((n) => (n.getAttribute('epub:type') ?? '').split(/\s+/).includes('toc')) ?? navs[0];
      if (tocNav) {
        const entries = tags(tocNav, 'a', [])
          .map((a) => ({ href: a.getAttribute('href'), label: collapse(a.textContent ?? '') }))
          .filter((a): a is { href: string; label: string } => !!a.href && !!a.label)
          .map((a) => ({ label: a.label, ...resolvePath(nav.path, a.href) }));
        if (entries.length) return entries;
      }
    }
  }

  const ncxId = spineEl?.getAttribute('toc');
  const ncx = (ncxId && manifest.get(ncxId)) || [...manifest.values()].find((m) => m.mediaType === 'application/x-dtbncx+xml');
  if (ncx) {
    const text = await read(ncx.path);
    if (text) {
      const doc = parseXml(text);
      return tags(doc, 'navPoint', ['ncx'])
        .map((np) => ({
          label: collapse(tags(np, 'text', ['ncx'])[0]?.textContent ?? ''),
          src: tags(np, 'content', ['ncx'])[0]?.getAttribute('src'),
        }))
        .filter((e): e is { label: string; src: string } => !!e.label && !!e.src)
        .map((e) => ({ label: e.label, ...resolvePath(ncx.path, e.src) }));
    }
  }
  return [];
}
