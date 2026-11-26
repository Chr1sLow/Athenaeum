// Builds small text PDFs in memory for importer tests.
import { crc32, deflateSync } from 'node:zlib';
import { PDFArray, PDFDocument, PDFHexString, PDFName, PDFNull, type PDFRef, StandardFonts, rgb } from 'pdf-lib';

/** Part of a line in its own size, e.g. a footnote marker: `{ text: '7', size: 7, rise: 4 }`. */
export interface PdfRun {
  text: string;
  /** Font size in points (default: the line's size). */
  size?: number;
  /** Points above the baseline; superscripts sit a few points up. */
  rise?: number;
}

export type PdfLine =
  | string
  | {
      /** The line's text, or `runs` for a line mixing sizes. */
      text: string | PdfRun[];
      /** Font size in points (default 12). */
      size?: number;
      /** Extra left indent in points. */
      indent?: number;
      /** Extra vertical space above this line, in points. */
      gapBefore?: number;
      /** Absolute position (for running headers / page numbers). Doesn't advance the cursor. */
      at?: { x: number; y: number };
    };

export interface PdfSpec {
  title?: string;
  author?: string;
  /** Each page is a list of lines laid out top to bottom. */
  pages: PdfLine[][];
  /** Bookmarks: title → zero-based page index. */
  outline?: { title: string; page: number }[];
  /** Pictures, each drawn centred on a page (zero-based), scaled to fit inside the margins. */
  images?: PdfImage[];
}

export interface PdfImage {
  page: number;
  /** Size in pixels. */
  width: number;
  height: number;
  /** Fill colour, 0-255 each (default a mid grey). */
  rgb?: [number, number, number];
}

const PAGE_W = 612;
const PAGE_H = 792;
const LEFT = 72;
const TOP = 720;

export async function makePdf(spec: PdfSpec): Promise<Buffer> {
  const doc = await PDFDocument.create();
  if (spec.title) doc.setTitle(spec.title);
  if (spec.author) doc.setAuthor(spec.author);
  const font = await doc.embedFont(StandardFonts.TimesRoman);

  for (const lines of spec.pages) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    let y = TOP;
    for (const raw of lines) {
      const line = typeof raw === 'string' ? { text: raw } : raw;
      const size = line.size ?? 12;
      const draw = (x: number, baseline: number) => {
        const runs = typeof line.text === 'string' ? [{ text: line.text }] : line.text;
        for (const run of runs) {
          const runSize = run.size ?? size;
          page.drawText(run.text, { x, y: baseline + (run.rise ?? 0), size: runSize, font, color: rgb(0, 0, 0) });
          x += font.widthOfTextAtSize(run.text, runSize);
        }
      };
      if (line.at) {
        draw(line.at.x, line.at.y);
        continue;
      }
      y -= line.gapBefore ?? 0;
      draw(LEFT + (line.indent ?? 0), y);
      y -= size * 1.4;
    }
  }

  for (const image of spec.images ?? []) {
    const png = await doc.embedPng(solidPng(image.width, image.height, image.rgb ?? [128, 128, 128]));
    const scale = Math.min(1, (PAGE_W - 2 * LEFT) / image.width, (TOP - LEFT) / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    doc.getPages()[image.page]!.drawImage(png, { x: (PAGE_W - w) / 2, y: (PAGE_H - h) / 2, width: w, height: h });
  }

  if (spec.outline?.length) addOutline(doc, spec.outline);
  return Buffer.from(await doc.save());
}

/** A PNG of one solid colour, encoded here so tests need no binary files. */
export function solidPng(width: number, height: number, [r, g, b]: [number, number, number]): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB, no interlace
  const row = Buffer.alloc(1 + width * 3); // filter byte 0, then pixels
  for (let x = 0; x < width; x++) row.set([r, g, b], 1 + x * 3);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A PDF whose only page is a drawn rectangle: what a scan without OCR looks like to a text extractor. */
export async function makeImageOnlyPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([PAGE_W, PAGE_H]).drawRectangle({ x: 50, y: 50, width: 500, height: 600, color: rgb(0.8, 0.8, 0.8) });
  return Buffer.from(await doc.save());
}

function addOutline(doc: PDFDocument, entries: { title: string; page: number }[]) {
  const ctx = doc.context;
  const outlinesRef = ctx.nextRef();
  const refs: PDFRef[] = entries.map(() => ctx.nextRef());
  const pages = doc.getPages();
  entries.forEach((entry, i) => {
    const dest = PDFArray.withContext(ctx);
    dest.push(pages[entry.page]!.ref);
    dest.push(PDFName.of('XYZ'));
    dest.push(PDFNull);
    dest.push(PDFNull);
    dest.push(PDFNull);
    const item = ctx.obj({
      Title: PDFHexString.fromText(entry.title),
      Parent: outlinesRef,
      Dest: dest,
    });
    if (i > 0) item.set(PDFName.of('Prev'), refs[i - 1]!);
    if (i < entries.length - 1) item.set(PDFName.of('Next'), refs[i + 1]!);
    ctx.assign(refs[i]!, item);
  });
  ctx.assign(
    outlinesRef,
    ctx.obj({ Type: 'Outlines', First: refs[0]!, Last: refs[refs.length - 1]!, Count: entries.length }),
  );
  doc.catalog.set(PDFName.of('Outlines'), outlinesRef);
}

/** Splits a paragraph into lines of at most `width` characters, like a typeset page would. */
export function wrap(paragraph: string, width = 80): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of paragraph.split(/\s+/)) {
    if (current && current.length + 1 + word.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Splits a long list of lines into pages of `perPage` lines. */
export function paginate(lines: PdfLine[], perPage = 38): PdfLine[][] {
  const pages: PdfLine[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  return pages;
}

/** Deterministic filler prose: `n` words. */
export function words(n: number, seed = 0): string {
  const vocab = ['the', 'river', 'quiet', 'lantern', 'walked', 'under', 'silver', 'morning', 'stone', 'and', 'she', 'remembered'];
  return Array.from({ length: n }, (_, i) => vocab[(i * 7 + seed) % vocab.length]).join(' ');
}
