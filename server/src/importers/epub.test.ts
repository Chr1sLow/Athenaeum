import { describe, expect, it } from 'vitest';
import { PNG_1PX, makeEpub } from '../test/fixtures/epub.ts';
import { solidPng } from '../test/fixtures/pdf.ts';
import { parseEpub } from './epub.ts';
import { ImportError } from './errors.ts';

const texts = (blocks: { type: string; text?: string }[]) =>
  blocks.filter((b) => b.type === 'p').map((b) => b.text);

describe('parseEpub: metadata', () => {
  it('reads title, author and a plain-text description', async () => {
    const book = await parseEpub(
      await makeEpub({
        title: 'The Lantern Road',
        author: 'Mara Quill',
        description: '<p>A <b>quiet</b> story.</p>',
        files: [{ name: 'c1.xhtml', body: '<p>Hello.</p>' }],
      }),
    );
    expect(book.title).toBe('The Lantern Road');
    expect(book.author).toBe('Mara Quill');
    expect(book.description).toBe('A quiet story.');
  });

  it('leaves author and description null when missing', async () => {
    const book = await parseEpub(await makeEpub({ title: 'T', files: [{ name: 'c1.xhtml', body: '<p>Hi.</p>' }] }));
    expect(book.author).toBeNull();
    expect(book.description).toBeNull();
  });
});

describe('parseEpub: chapters', () => {
  it('follows the EPUB 3 table of contents for titles and order', async () => {
    const book = await parseEpub(
      await makeEpub({
        title: 'T',
        files: [
          { name: 'c1.xhtml', body: '<h1>Chapter One</h1><p>First paragraph.</p><p>Second paragraph.</p>' },
          { name: 'c2.xhtml', body: '<h2>Chapter Two</h2><p>Third paragraph.</p>' },
        ],
        toc: [
          { label: 'One: The Arrival', href: 'c1.xhtml' },
          { label: 'Two: The Storm', href: 'c2.xhtml' },
        ],
      }),
    );
    expect(book.chapters.map((c) => c.title)).toEqual(['One: The Arrival', 'Two: The Storm']);
    expect(texts(book.chapters[0]!.blocks)).toEqual(['First paragraph.', 'Second paragraph.']);
    expect(texts(book.chapters[1]!.blocks)).toEqual(['Third paragraph.']);
  });

  it('drops the heading at the top of a chapter, since the reader shows the title itself', async () => {
    const book = await parseEpub(
      await makeEpub({
        title: 'T',
        files: [{ name: 'c1.xhtml', body: '<h1>Chapter One</h1><p>Text.</p><h2>A Later Section</h2><p>More.</p>' }],
        toc: [{ label: 'Chapter One', href: 'c1.xhtml' }],
      }),
    );
    expect(book.chapters[0]!.blocks).toEqual([
      { type: 'p', text: 'Text.' },
      { type: 'h', level: 2, text: 'A Later Section' },
      { type: 'p', text: 'More.' },
    ]);
  });

  it('reads an EPUB 2 NCX table of contents', async () => {
    const book = await parseEpub(
      await makeEpub({
        version: 2,
        title: 'T',
        files: [
          { name: 'a.xhtml', body: '<p>Alpha.</p>' },
          { name: 'b.xhtml', body: '<p>Beta.</p>' },
        ],
        toc: [
          { label: 'Prologue', href: 'a.xhtml' },
          { label: 'Chapter 1', href: 'b.xhtml' },
        ],
      }),
    );
    expect(book.chapters.map((c) => c.title)).toEqual(['Prologue', 'Chapter 1']);
  });

  it('splits one file into several chapters at table-of-contents anchors', async () => {
    const book = await parseEpub(
      await makeEpub({
        title: 'T',
        files: [
          {
            name: 'all.xhtml',
            body: '<h2 id="c1">I</h2><p>One.</p><p>Uno.</p><h2 id="c2">II</h2><p>Two.</p><div id="c3"><h2>III</h2><p>Three.</p></div>',
          },
        ],
        toc: [
          { label: 'I', href: 'all.xhtml#c1' },
          { label: 'II', href: 'all.xhtml#c2' },
          { label: 'III', href: 'all.xhtml#c3' },
        ],
      }),
    );
    expect(book.chapters.map((c) => [c.title, texts(c.blocks)])).toEqual([
      ['I', ['One.', 'Uno.']],
      ['II', ['Two.']],
      ['III', ['Three.']],
    ]);
  });

  it('flattens nested entries and folds an empty part heading into the next chapter', async () => {
    const book = await parseEpub(
      await makeEpub({
        title: 'T',
        files: [
          { name: 'part1.xhtml', body: '<h1>Part One</h1>' },
          { name: 'c1.xhtml', body: '<p>Chapter one text.</p>' },
          { name: 'c2.xhtml', body: '<p>Chapter two text.</p>' },
        ],
        toc: [
          {
            label: 'Part One',
            href: 'part1.xhtml',
            children: [
              { label: 'Chapter 1', href: 'c1.xhtml' },
              { label: 'Chapter 2', href: 'c2.xhtml' },
            ],
          },
        ],
      }),
    );
    expect(book.chapters.map((c) => c.title)).toEqual(['Chapter 1', 'Chapter 2']);
  });

  it('keeps text before the first table-of-contents entry as "Front Matter"', async () => {
    const book = await parseEpub(
      await makeEpub({
        title: 'T',
        files: [
          { name: 'title.xhtml', body: '<p>Copyright 2026. All rights reserved.</p>' },
          { name: 'c1.xhtml', body: '<p>Story.</p>' },
        ],
        toc: [{ label: 'Chapter 1', href: 'c1.xhtml' }],
      }),
    );
    expect(book.chapters.map((c) => c.title)).toEqual(['Front Matter', 'Chapter 1']);
  });

  it('without a table of contents, makes one chapter per file titled by its first heading', async () => {
    const book = await parseEpub(
      await makeEpub({
        title: 'T',
        files: [
          { name: 'a.xhtml', body: '<h1>The Beginning</h1><p>A.</p>' },
          { name: 'b.xhtml', body: '<p>No heading here.</p>' },
        ],
      }),
    );
    expect(book.chapters.map((c) => c.title)).toEqual(['The Beginning', 'Chapter 2']);
  });

  it('skips files with no text, like a cover wrapper page', async () => {
    const book = await parseEpub(
      await makeEpub({
        title: 'T',
        files: [
          { name: 'cover.xhtml', body: '<div><img src="cover.png" alt="Cover"/></div>' },
          { name: 'c1.xhtml', body: '<p>Story.</p>' },
        ],
        images: [{ name: 'cover.png', mime: 'image/png', data: PNG_1PX, cover: true }],
      }),
    );
    expect(book.chapters).toHaveLength(1);
    expect(texts(book.chapters[0]!.blocks)).toEqual(['Story.']);
  });

  it('skips files marked as not part of the reading order', async () => {
    const book = await parseEpub(
      await makeEpub({
        title: 'T',
        files: [
          { name: 'c1.xhtml', body: '<p>Story.</p>' },
          { name: 'notes.xhtml', body: '<p>Endnote.</p>', nonLinear: true },
        ],
      }),
    );
    expect(book.chapters.flatMap((c) => texts(c.blocks))).toEqual(['Story.']);
  });

  it('counts words per chapter', async () => {
    const book = await parseEpub(
      await makeEpub({
        title: 'T',
        files: [{ name: 'c1.xhtml', body: '<p>One two three.</p><p>Four  five\n six.</p>' }],
      }),
    );
    expect(book.chapters[0]!.wordCount).toBe(6);
  });
});

describe('parseEpub: text and markup', () => {
  it('collapses whitespace and turns loose text and divs into paragraphs', async () => {
    const book = await parseEpub(
      await makeEpub({
        title: 'T',
        files: [{ name: 'c1.xhtml', body: '<div>  Loose\n   text  </div><section><p>  In   a\tsection </p></section>' }],
      }),
    );
    expect(texts(book.chapters[0]!.blocks)).toEqual(['Loose text', 'In a section']);
  });

  it('keeps italics and bold, and strips scripts, attributes and links', async () => {
    const book = await parseEpub(
      await makeEpub({
        title: 'T',
        files: [
          {
            name: 'c1.xhtml',
            body: '<p class="x" onclick="evil()">She <em>whispered</em>, <strong onmouseover="x()">run</strong> <a href="http://evil.example">here</a>.<script>alert(1)</script></p>',
          },
        ],
      }),
    );
    expect(book.chapters[0]!.blocks).toEqual([
      { type: 'p', text: 'She whispered, run here.', html: 'She <em>whispered</em>, <strong>run</strong> here.' },
    ]);
  });

  it('escapes text so it can never be read as markup', async () => {
    const book = await parseEpub(
      await makeEpub({
        title: 'T',
        files: [{ name: 'c1.xhtml', body: '<p>1 &lt; 2 &amp; <i>&lt;b&gt;bold?&lt;/b&gt;</i></p>' }],
      }),
    );
    expect(book.chapters[0]!.blocks[0]).toEqual({
      type: 'p',
      text: '1 < 2 & <b>bold?</b>',
      html: '1 &lt; 2 &amp; <i>&lt;b&gt;bold?&lt;/b&gt;</i>',
    });
  });

  it('turns <hr> into a scene break and keeps line breaks inside a paragraph', async () => {
    const book = await parseEpub(
      await makeEpub({
        title: 'T',
        files: [{ name: 'c1.xhtml', body: '<p>Roses are red,<br/>violets are blue.</p><hr/><p>Later.</p>' }],
      }),
    );
    expect(book.chapters[0]!.blocks).toEqual([
      { type: 'p', text: 'Roses are red, violets are blue.', html: 'Roses are red,<br>violets are blue.' },
      { type: 'hr' },
      { type: 'p', text: 'Later.' },
    ]);
  });
});

describe('parseEpub: images', () => {
  it('extracts the EPUB 3 cover image', async () => {
    const book = await parseEpub(
      await makeEpub({
        title: 'T',
        files: [{ name: 'c1.xhtml', body: '<p>Hi.</p>' }],
        images: [{ name: 'img/cover.png', mime: 'image/png', data: PNG_1PX, cover: true }],
      }),
    );
    expect(book.cover).toEqual({ mime: 'image/png', data: PNG_1PX });
  });

  it('extracts the EPUB 2 cover image', async () => {
    const book = await parseEpub(
      await makeEpub({
        version: 2,
        title: 'T',
        files: [{ name: 'c1.xhtml', body: '<p>Hi.</p>' }],
        images: [{ name: 'cover.png', mime: 'image/png', data: PNG_1PX, cover: true }],
      }),
    );
    expect(book.cover?.mime).toBe('image/png');
  });

  it('has no cover when the book declares none and has no pictures', async () => {
    const book = await parseEpub(await makeEpub({ title: 'T', files: [{ name: 'c1.xhtml', body: '<p>Hi.</p>' }] }));
    expect(book.cover).toBeNull();
  });

  describe('without a declared cover', () => {
    const red = solidPng(300, 450, [200, 40, 40]);
    const blue = solidPng(400, 300, [40, 40, 200]);

    it('uses the first picture in reading order (not manifest order)', async () => {
      const book = await parseEpub(
        await makeEpub({
          title: 'T',
          files: [
            { name: 'c1.xhtml', body: '<p>Hi.</p>' },
            { name: 'c2.xhtml', body: '<p>Two.</p><p><img src="b.png" alt=""/></p>' },
            { name: 'c3.xhtml', body: '<p>Three.</p><p><img src="a.png" alt=""/></p>' },
          ],
          images: [
            { name: 'a.png', mime: 'image/png', data: blue },
            { name: 'b.png', mime: 'image/png', data: red },
          ],
        }),
      );
      expect(book.cover).toEqual({ mime: 'image/png', data: red });
    });

    it('finds a picture drawn with SVG, as cover pages often are', async () => {
      const book = await parseEpub(
        await makeEpub({
          title: 'T',
          files: [
            { name: 'title.xhtml', body: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="art.png"/></svg>' },
            { name: 'c1.xhtml', body: '<p>Hi.</p>' },
          ],
          images: [{ name: 'art.png', mime: 'image/png', data: red }],
        }),
      );
      expect(book.cover).toEqual({ mime: 'image/png', data: red });
    });

    it('skips small decorations such as section-break ornaments', async () => {
      const book = await parseEpub(
        await makeEpub({
          title: 'T',
          files: [
            { name: 'c1.xhtml', body: '<p>Hi.</p><p><img src="dot.png" alt=""/></p><p>More.</p>' },
            { name: 'c2.xhtml', body: '<p>Two.</p><p><img src="art.png" alt=""/></p>' },
          ],
          images: [
            { name: 'dot.png', mime: 'image/png', data: PNG_1PX },
            { name: 'art.png', mime: 'image/png', data: blue },
          ],
        }),
      );
      expect(book.cover).toEqual({ mime: 'image/png', data: blue });
    });

    it('has no cover when the only pictures are decorations', async () => {
      const book = await parseEpub(
        await makeEpub({
          title: 'T',
          files: [{ name: 'c1.xhtml', body: '<p>Hi.</p><p><img src="dot.png" alt=""/></p>' }],
          images: [{ name: 'dot.png', mime: 'image/png', data: PNG_1PX }],
        }),
      );
      expect(book.cover).toBeNull();
    });
  });

  it('prefers the declared cover over pictures in the text', async () => {
    const book = await parseEpub(
      await makeEpub({
        title: 'T',
        files: [{ name: 'c1.xhtml', body: '<p>Hi.</p><p><img src="art.png" alt=""/></p>' }],
        images: [
          { name: 'art.png', mime: 'image/png', data: solidPng(300, 450, [200, 40, 40]) },
          { name: 'cover.png', mime: 'image/png', data: PNG_1PX, cover: true },
        ],
      }),
    );
    expect(book.cover).toEqual({ mime: 'image/png', data: PNG_1PX });
  });

  it('turns illustrations into image blocks that point at extracted image data', async () => {
    const book = await parseEpub(
      await makeEpub({
        title: 'T',
        files: [{ name: 'text/c1.xhtml', body: '<p>Before.</p><p><img src="../art/map.png" alt="A map"/></p><p>After.</p>' }],
        images: [{ name: 'art/map.png', mime: 'image/png', data: PNG_1PX }],
      }),
    );
    const blocks = book.chapters[0]!.blocks;
    expect(blocks.map((b) => b.type)).toEqual(['p', 'img', 'p']);
    const img = blocks[1] as { type: 'img'; imageId: string; alt?: string };
    expect(img.alt).toBe('A map');
    expect(book.images).toEqual([{ key: img.imageId, mime: 'image/png', data: PNG_1PX }]);
  });
});

describe('parseEpub: errors', () => {
  it('rejects a file that is not a zip', async () => {
    await expect(parseEpub(Buffer.from('definitely not an epub'))).rejects.toThrow(ImportError);
  });

  it('rejects a zip without an EPUB package', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('readme.txt', 'hello');
    await expect(parseEpub(await zip.generateAsync({ type: 'nodebuffer' }))).rejects.toThrow(
      /doesn't look like an EPUB/,
    );
  });

  it('rejects an EPUB with no readable text', async () => {
    await expect(
      parseEpub(await makeEpub({ title: 'T', files: [{ name: 'c1.xhtml', body: '<div></div>' }] })),
    ).rejects.toThrow(/no readable text/);
  });
});
