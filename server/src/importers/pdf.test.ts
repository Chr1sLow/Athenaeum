import type { Block } from '@athenaeum/shared';
import { describe, expect, it } from 'vitest';
import { type PdfLine, type PdfRun, makeImageOnlyPdf, makePdf, paginate, words, wrap } from '../test/fixtures/pdf.ts';
import { ImportError } from './errors.ts';
import { closesBracketBlock, endsSentence, parsePdf } from './pdf.ts';

const paragraphs = (book: Awaited<ReturnType<typeof parsePdf>>) =>
  book.chapters.flatMap((c) => c.blocks.filter((b) => b.type === 'p').map((b) => (b as { text: string }).text));

/** One paragraph as typeset lines; later paragraphs get a blank-line gap. */
const para = (text: string, opts: { gap?: boolean; indent?: boolean } = {}): PdfLine[] =>
  wrap(text).map((line, i) =>
    i === 0 ? { text: line, gapBefore: opts.gap ? 12 : 0, indent: opts.indent ? 24 : 0 } : line,
  );

const P1 = `It was the kind of morning that made the river look like hammered silver, and Ada walked the towpath slowly because there was nowhere she needed to be before noon.`;
const P2 = `The lantern-maker's shop stood at the end of the lane, its windows fogged with steam from a kettle that never seemed to stop boiling, whatever the season or the hour.`;

describe('parsePdf: metadata', () => {
  it('reads title and author from the document info', async () => {
    const book = await parsePdf(await makePdf({ title: 'The Lantern Road', author: 'Mara Quill', pages: [[P1]] }), 'x.pdf');
    expect(book.title).toBe('The Lantern Road');
    expect(book.author).toBe('Mara Quill');
  });

  it('falls back to a tidied file name when the PDF has no title', async () => {
    const book = await parsePdf(await makePdf({ pages: [[P1.slice(0, 60)]] }), 'My_Novel-Draft.pdf');
    expect(book.title).toBe('My Novel Draft');
    expect(book.author).toBeNull();
  });
});

describe('parsePdf: paragraphs', () => {
  it('joins wrapped lines back into one paragraph', async () => {
    const book = await parsePdf(await makePdf({ pages: [para(P1)] }), 'x.pdf');
    expect(paragraphs(book)).toEqual([P1]);
  });

  it('starts a new paragraph after a vertical gap', async () => {
    const book = await parsePdf(await makePdf({ pages: [[...para(P1), ...para(P2, { gap: true })]] }), 'x.pdf');
    expect(paragraphs(book)).toEqual([P1, P2]);
  });

  it('starts a new paragraph at an indented first line', async () => {
    const book = await parsePdf(
      await makePdf({ pages: [[...para(P1, { indent: true }), ...para(P2, { indent: true })]] }),
      'x.pdf',
    );
    expect(paragraphs(book)).toEqual([P1, P2]);
  });

  it('starts a new paragraph after a short line that ends a sentence', async () => {
    const book = await parsePdf(
      await makePdf({ pages: [[...wrap(P1), 'She stopped.', ...wrap(P2)]] }),
      'x.pdf',
    );
    expect(paragraphs(book)).toEqual([P1, 'She stopped.', P2]);
  });

  it('rejoins words hyphenated across a line break, but keeps real hyphens', async () => {
    const book = await parsePdf(
      await makePdf({
        pages: [
          [
            'It was an extraordi-',
            'nary day for the long walk out to the old mill by the water, she thought,',
            'and Jean-',
            'Paul agreed with her completely.',
          ],
        ],
      }),
      'x.pdf',
    );
    expect(paragraphs(book)).toEqual([
      'It was an extraordinary day for the long walk out to the old mill by the water, she thought, and Jean-Paul agreed with her completely.',
    ]);
  });

  it('joins a paragraph that continues onto the next page', async () => {
    const lines = wrap(P1 + ' ' + P2);
    const book = await parsePdf(await makePdf({ pages: [lines.slice(0, 2), lines.slice(2)] }), 'x.pdf');
    expect(paragraphs(book)).toEqual([`${P1} ${P2}`]);
  });

  it('drops page numbers and repeated running headers', async () => {
    const pages = [P1, P2, P1].map((p, i) => [
      { text: 'THE LANTERN ROAD', size: 9, at: { x: 250, y: 760 } },
      ...para(p, { indent: true }),
      { text: String(i + 1), size: 9, at: { x: 300, y: 40 } },
    ]);
    const book = await parsePdf(await makePdf({ pages }), 'x.pdf');
    expect(paragraphs(book)).toEqual([P1, P2, P1]);
  });

  it('counts words', async () => {
    const book = await parsePdf(await makePdf({ pages: [['One two three four five.']] }), 'x.pdf');
    expect(book.chapters[0]!.wordCount).toBe(5);
  });
});

describe('parsePdf: chapters', () => {
  it('uses the PDF bookmarks when it has them', async () => {
    const book = await parsePdf(
      await makePdf({
        pages: [para(P1), para(P2), para(P1)],
        outline: [
          { title: 'The Arrival', page: 0 },
          { title: 'The Storm', page: 1 },
        ],
      }),
      'x.pdf',
    );
    expect(book.chapters.map((c) => [c.title, paragraphs({ ...book, chapters: [c] })])).toEqual([
      ['The Arrival', [P1]],
      ['The Storm', [P2, P1]],
    ]);
  });

  it('finds large-type chapter headings and keeps earlier pages as Front Matter', async () => {
    const book = await parsePdf(
      await makePdf({
        pages: [
          ['Copyright 2026 Mara Quill. All rights reserved.'],
          [{ text: 'Chapter 1', size: 20 }, ...para(P1, { gap: true })],
          [{ text: 'Chapter 2', size: 20 }, ...para(P2, { gap: true })],
        ],
      }),
      'x.pdf',
    );
    expect(book.chapters.map((c) => c.title)).toEqual(['Front Matter', 'Chapter 1', 'Chapter 2']);
    expect(paragraphs({ ...book, chapters: [book.chapters[1]!] })).toEqual([P1]);
  });

  it('recognizes chapter headings set in body-size type', async () => {
    const book = await parsePdf(
      await makePdf({
        pages: [
          [{ text: 'CHAPTER I', gapBefore: 0 }, ...para(P1, { gap: true }), { text: 'CHAPTER II', gapBefore: 24 }, ...para(P2, { gap: true })],
        ],
      }),
      'x.pdf',
    );
    expect(book.chapters.map((c) => c.title)).toEqual(['CHAPTER I', 'CHAPTER II']);
  });

  it('combines a chapter number with the title line under it', async () => {
    const book = await parsePdf(
      await makePdf({
        pages: [
          [{ text: 'Chapter 3', size: 20 }, { text: 'The Storm', size: 20 }, ...para(P1, { gap: true })],
          [{ text: 'Chapter 4', size: 20 }, ...para(P2, { gap: true })],
        ],
      }),
      'x.pdf',
    );
    expect(book.chapters.map((c) => c.title)).toEqual(['Chapter 3: The Storm', 'Chapter 4']);
  });

  it('does not mistake a table of contents for a run of empty chapters', async () => {
    const book = await parsePdf(
      await makePdf({
        pages: [
          ['Contents', 'Chapter 1. The Arrival', 'Chapter 2. The Storm', 'Chapter 3. The Return'],
          [{ text: 'Chapter 1. The Arrival', size: 20 }, ...para(P1, { gap: true })],
          [{ text: 'Chapter 2. The Storm', size: 20 }, ...para(P2, { gap: true })],
          [{ text: 'Chapter 3. The Return', size: 20 }, ...para(P1, { gap: true })],
        ],
      }),
      'x.pdf',
    );
    expect(book.chapters.map((c) => c.title)).toEqual([
      'Front Matter',
      'Chapter 1. The Arrival',
      'Chapter 2. The Storm',
      'Chapter 3. The Return',
    ]);
  });

  it('joins a number ending in punctuation to its title with a space, and keeps question titles', async () => {
    const book = await parsePdf(
      await makePdf({
        pages: [
          [{ text: 'CHAPTER XI.', size: 20 }, { text: 'Who Stole the Tarts?', size: 20 }, ...para(P1, { gap: true })],
          [{ text: 'CHAPTER XII.', size: 20 }, { text: 'Alice’s Evidence', size: 20 }, ...para(P2, { gap: true })],
        ],
      }),
      'x.pdf',
    );
    expect(book.chapters.map((c) => c.title)).toEqual(['CHAPTER XI. Who Stole the Tarts?', 'CHAPTER XII. Alice’s Evidence']);
  });

  it('splits a book with no chapter markers into sections of about 3,000 words', async () => {
    const lines = Array.from({ length: 70 }, (_, i) => para(words(100, i), { indent: true })).flat();
    const book = await parsePdf(await makePdf({ pages: paginate(lines) }), 'x.pdf');
    expect(book.chapters.map((c) => c.title)).toEqual(['Section 1', 'Section 2', 'Section 3']);
    expect(book.chapters.map((c) => c.wordCount)).toEqual([3000, 3000, 1000]);
  });
});

describe('parsePdf: paragraph breaks in dialogue-heavy books', () => {
  /** One full-width line that ends a sentence, like most lines of a novel told in short paragraphs. */
  const sentence = (seed: number) => `${words(13, seed)} river.`;

  it('breaks at the space between paragraphs even when most paragraphs are a single line', async () => {
    const singles = [1, 2, 3, 4, 5, 6, 7, 8].map(sentence);
    const book = await parsePdf(
      await makePdf({ pages: [[...para(P1), ...singles.map((text) => ({ text, gapBefore: 10 }))]] }),
      'x.pdf',
    );
    expect(paragraphs(book)).toEqual([P1, ...singles]);
  });

  it('ends a paragraph when a bracketed box that opened it closes, even with no space after it', async () => {
    const book = await parsePdf(
      await makePdf({
        pages: [
          [
            '[Main Scenario #1 - Proof of Worth. Clear condition: kill one or more living beings.]',
            'The dokkaebi smiled as it faded through the wall of the next subway carriage, and',
            'the people around me began to scream.',
            '[A constellation draped in a ragged robe is waiting expectantly to see what you',
            'will do.]',
            'The statue was modeled after a monk who had lived long ago in the old dynasty.',
          ],
        ],
      }),
      'x.pdf',
    );
    expect(paragraphs(book)).toEqual([
      '[Main Scenario #1 - Proof of Worth. Clear condition: kill one or more living beings.]',
      'The dokkaebi smiled as it faded through the wall of the next subway carriage, and the people around me began to scream.',
      '[A constellation draped in a ragged robe is waiting expectantly to see what you will do.]',
      'The statue was modeled after a monk who had lived long ago in the old dynasty.',
    ]);
  });

  it('knows the brackets that box quotes and messages in translated novels', () => {
    expect(closesBracketBlock('「A strange creature covered in fuzz', 'draped in a coarse cloth.」')).toBe(true);
    expect(closesBracketBlock('『The Book of Ways』', '『The Book of Ways』')).toBe(true);
    expect(closesBracketBlock('【System】 A new scenario', 'has arrived.】')).toBe(true);
    expect(closesBracketBlock('[A new main scenario has arrived!', 'arrived!]')).toBe(true);
    expect(closesBracketBlock('「Mismatched', 'brackets]')).toBe(false);
    expect(closesBracketBlock('Plain text that', 'ends with a bracket]')).toBe(false);
    expect(closesBracketBlock('「Still going', 'on and on')).toBe(false);
    expect(endsSentence('a coarse cloth.」')).toBe(true);
    expect(endsSentence('『The Book of Ways』')).toBe(true);
    expect(endsSentence('and then the')).toBe(false);
  });
});

describe('parsePdf: illustrations', () => {
  const galleryOf = (c: { gallery: { width: number; height: number }[] }) => c.gallery.map(({ width, height }) => [width, height]);

  it("puts each illustration in the gallery of the chapter it follows, not in the chapter's text", async () => {
    const book = await parsePdf(
      await makePdf({
        pages: [
          [{ text: 'Chapter 1', size: 20 }, ...para(P1, { gap: true })],
          [],
          [{ text: 'Chapter 2', size: 20 }, ...para(P2, { gap: true })],
          [],
        ],
        images: [
          { page: 1, width: 300, height: 400 },
          { page: 3, width: 400, height: 300 },
        ],
      }),
      'x.pdf',
    );
    expect(book.chapters.map((c) => [c.title, galleryOf(c)])).toEqual([
      ['Chapter 1', [[300, 400]]],
      ['Chapter 2', [[400, 300]]],
    ]);
    expect(book.chapters.flatMap((c) => c.blocks).filter((b) => b.type === 'img')).toEqual([]);
    // Each gallery entry points at a stored JPEG.
    const keys = book.chapters.flatMap((c) => c.gallery.map((g) => g.key));
    expect(book.images.map((i) => i.key)).toEqual(keys);
    for (const image of book.images) {
      expect(image.mime).toBe('image/jpeg');
      expect([...image.data.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    }
  });

  it('gives an illustration that comes before any text to the first chapter', async () => {
    const book = await parsePdf(
      await makePdf({
        pages: [[], [{ text: 'Chapter 1', size: 20 }, ...para(P1, { gap: true })]],
        images: [{ page: 0, width: 300, height: 400 }],
      }),
      'x.pdf',
    );
    expect(book.chapters.map((c) => [c.title, galleryOf(c)])).toEqual([['Chapter 1', [[300, 400]]]]);
  });

  it('leaves out small decorations such as ornaments and icons', async () => {
    const book = await parsePdf(
      await makePdf({ pages: [para(P1)], images: [{ page: 0, width: 40, height: 40 }] }),
      'x.pdf',
    );
    expect(book.chapters[0]!.gallery).toEqual([]);
    expect(book.images).toEqual([]);
  });
});

describe('parsePdf: footnotes', () => {
  // Laid out like the PDFs that prompted this: 12pt text with small raised note numbers, and the
  // notes themselves in 9pt type at the foot of the page.
  const mark = (label: string): PdfRun => ({ text: label, size: 7, rise: 4 });
  /** A note at the foot of the page: its raised number, then the note in small type. */
  const footnote = (label: string, text: string, y: number): PdfLine => ({
    text: [{ text: label, size: 5.5, rise: 3.5 }, { text: ` ${text}` }],
    size: 9,
    at: { x: 72, y },
  });
  const DOKKAEBI = 'Dokkaebi are mythological creatures from Korean folklore.';
  const AR = 'AR is short for augmented reality.';
  const notesOf = (chapter: { blocks: Block[] }) =>
    chapter.blocks.filter((b): b is Extract<Block, { type: 'note' }> => b.type === 'note');

  it('keeps a note number in its place in the sentence, as a superscript', async () => {
    const book = await parsePdf(
      await makePdf({
        pages: [[{ text: [{ text: '"A dokkaebi' }, mark('7'), { text: '." That was what someone called it.' }] }]],
      }),
      'x.pdf',
    );
    expect(book.chapters[0]!.blocks[0]).toEqual({
      type: 'p',
      text: '"A dokkaebi7." That was what someone called it.',
      html: '"A dokkaebi<sup>7</sup>." That was what someone called it.',
    });
  });

  it('keeps the space after a note number that ends a word', async () => {
    const book = await parsePdf(
      await makePdf({ pages: [[{ text: [{ text: '"Is this one of those AR' }, mark('8'), { text: ' things?"' }] }]] }),
      'x.pdf',
    );
    expect(book.chapters[0]!.blocks[0]).toMatchObject({ html: '"Is this one of those AR<sup>8</sup> things?"' });
  });

  it('moves notes from the foot of each page to the end of their chapter', async () => {
    const book = await parsePdf(
      await makePdf({
        pages: [
          [
            { text: 'Chapter 1', size: 20 },
            { text: [{ text: 'Ada saw a dokkaebi' }, mark('7'), { text: ' on the towpath.' }], gapBefore: 12 },
            ...para(P1, { gap: true }),
            footnote('7', DOKKAEBI, 84),
          ],
          [...para(P2), { text: 'Chapter 2', size: 20, gapBefore: 24 }, ...para(P1, { gap: true })],
          [
            { text: [{ text: '"Is this one of those AR' }, mark('8'), { text: ' things?"' }] },
            ...para(P2, { gap: true }),
            footnote('8', AR, 84),
          ],
        ],
      }),
      'x.pdf',
    );
    const [one, two] = book.chapters;
    expect(book.chapters.map((c) => c.title)).toEqual(['Chapter 1', 'Chapter 2']);
    // The text reads straight on from page to page, with the note after it.
    expect(one!.blocks.map((b) => b.type)).toEqual(['p', 'p', 'p', 'note']);
    expect(paragraphs({ ...book, chapters: [one!] })).toEqual(['Ada saw a dokkaebi7 on the towpath.', P1, P2]);
    expect(notesOf(one!)).toEqual([{ type: 'note', label: '7', text: DOKKAEBI }]);
    expect(two!.blocks.at(-1)).toEqual({ type: 'note', label: '8', text: AR });
    expect(paragraphs({ ...book, chapters: [two!] })).not.toContain(AR);
  });

  it('gives a note to the chapter its number appears in, even when the next chapter starts on that page', async () => {
    const book = await parsePdf(
      await makePdf({
        pages: [
          [
            { text: 'Chapter 1', size: 20 },
            { text: [{ text: 'Ada saw a dokkaebi' }, mark('7'), { text: ' on the towpath.' }], gapBefore: 12 },
            ...para(P1, { gap: true }),
            { text: 'Chapter 2', size: 20, gapBefore: 24 },
            ...para(P2, { gap: true }),
            footnote('7', DOKKAEBI, 84),
          ],
        ],
      }),
      'x.pdf',
    );
    expect(book.chapters.map((c) => [c.title, notesOf(c).length])).toEqual([
      ['Chapter 1', 1],
      ['Chapter 2', 0],
    ]);
  });

  it('keeps notes in order when a numbered paragraph started on the page before', async () => {
    const book = await parsePdf(
      await makePdf({
        pages: [
          // The page ends mid-sentence, so the paragraph carries on over the page break.
          [...para(P1), { text: wrap(P2)[0]!, gapBefore: 12 }],
          [
            { text: [{ text: 'the paragraph goes on here and cites a dokkaebi' }, mark('1'), { text: ' before it ends.' }] },
            { text: [{ text: 'Then a second one cites AR' }, mark('2'), { text: ' things.' }], gapBefore: 12 },
            { text: 'And a third paragraph cites nothing at all.', gapBefore: 12 },
            footnote('1', DOKKAEBI, 96),
            footnote('2', AR, 84),
          ],
        ],
      }),
      'x.pdf',
    );
    expect(notesOf(book.chapters[0]!).map((n) => n.label)).toEqual(['1', '2']);
  });

  it('joins a note that runs over two lines, and still drops the page number under it', async () => {
    const book = await parsePdf(
      await makePdf({
        pages: [
          [
            { text: [{ text: 'Ada saw a dokkaebi' }, mark('7'), { text: ' on the towpath.' }] },
            ...para(P1, { gap: true }),
            footnote('7', 'Dokkaebi are mythological creatures from Korean folklore, also', 96),
            { text: 'known as Korean goblins.', size: 9, at: { x: 72, y: 85 } },
            { text: '12', size: 9, at: { x: 300, y: 40 } },
          ],
        ],
      }),
      'x.pdf',
    );
    const blocks = book.chapters[0]!.blocks;
    expect(blocks.at(-1)).toEqual({
      type: 'note',
      label: '7',
      text: 'Dokkaebi are mythological creatures from Korean folklore, also known as Korean goblins.',
    });
    expect(blocks.filter((b) => b.type !== 'note').map((b) => (b as { text: string }).text)).toEqual([
      'Ada saw a dokkaebi7 on the towpath.',
      P1,
    ]);
  });

  it('leaves small type at the foot of a page alone when it is not a numbered note', async () => {
    const book = await parsePdf(
      await makePdf({ pages: [[...para(P1), { text: 'Translated by the Lantern Road team.', size: 9, at: { x: 72, y: 84 } }]] }),
      'x.pdf',
    );
    expect(notesOf(book.chapters[0]!)).toEqual([]);
    expect(paragraphs(book)).toEqual([P1, 'Translated by the Lantern Road team.']);
  });
});

describe('parsePdf: cover', () => {
  it('uses the first picture in the book as the cover, not the whole page it sits on', async () => {
    const book = await parsePdf(
      await makePdf({
        pages: [[{ text: 'Lantern Road', size: 20 }], para(P1), [], para(P2)],
        images: [
          { page: 0, width: 300, height: 450, rgb: [200, 40, 40] },
          { page: 2, width: 400, height: 300, rgb: [40, 40, 200] },
        ],
      }),
      'x.pdf',
    );
    expect(book.images).toHaveLength(2);
    expect(book.cover).toEqual({ mime: 'image/jpeg', data: book.images[0]!.data });
  });

  it('renders the first page as a JPEG cover when the book has no pictures', async () => {
    const book = await parsePdf(await makePdf({ pages: [para(P1)] }), 'x.pdf');
    expect(book.cover?.mime).toBe('image/jpeg');
    expect(book.cover!.data.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  });

  it('renders the first page when the only pictures are small ornaments', async () => {
    const book = await parsePdf(await makePdf({ pages: [para(P1)], images: [{ page: 0, width: 40, height: 40 }] }), 'x.pdf');
    expect(book.images).toEqual([]);
    expect(book.cover?.mime).toBe('image/jpeg');
  });
});

describe('parsePdf: errors', () => {
  it('explains that a scanned PDF with no text layer cannot be read', async () => {
    await expect(parsePdf(await makeImageOnlyPdf(), 'scan.pdf')).rejects.toThrow(/no text/);
  });

  it('rejects a corrupt PDF', async () => {
    await expect(parsePdf(Buffer.from('%PDF-1.7\ngarbage'), 'bad.pdf')).rejects.toThrow(ImportError);
  });
});
