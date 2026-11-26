// Builds small EPUB files in memory for importer tests.
import JSZip from 'jszip';

/** A valid 1x1 PNG. */
export const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export interface EpubFile {
  /** Path inside OEBPS/, e.g. "ch1.xhtml". */
  name: string;
  /** Inner HTML of <body>. */
  body: string;
  /** Excluded from reading order (linear="no"). */
  nonLinear?: boolean;
}

export interface TocEntry {
  label: string;
  /** Relative to OEBPS/, may include #fragment. */
  href: string;
  children?: TocEntry[];
}

export interface EpubImage {
  name: string;
  mime: string;
  data: Buffer;
  cover?: boolean;
}

export interface EpubSpec {
  version?: 2 | 3;
  title?: string;
  author?: string;
  description?: string;
  files: EpubFile[];
  /** Omit for no table of contents. */
  toc?: TocEntry[];
  images?: EpubImage[];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const xhtml = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>x</title><link rel="stylesheet" href="style.css"/></head>
<body>${body}</body>
</html>`;

function navDoc(toc: TocEntry[]): string {
  const list = (entries: TocEntry[]): string =>
    `<ol>${entries
      .map((e) => `<li><a href="${esc(e.href)}">${esc(e.label)}</a>${e.children ? list(e.children) : ''}</li>`)
      .join('')}</ol>`;
  return xhtml(`<nav epub:type="toc" id="toc"><h1>Contents</h1>${list(toc)}</nav>`);
}

function ncxDoc(toc: TocEntry[]): string {
  let order = 0;
  const points = (entries: TocEntry[]): string =>
    entries
      .map((e) => {
        order++;
        return `<navPoint id="np${order}" playOrder="${order}"><navLabel><text>${esc(e.label)}</text></navLabel><content src="${esc(e.href)}"/>${e.children ? points(e.children) : ''}</navPoint>`;
      })
      .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="test"/></head>
<docTitle><text>x</text></docTitle>
<navMap>${points(toc)}</navMap>
</ncx>`;
}

export async function makeEpub(spec: EpubSpec): Promise<Buffer> {
  const version = spec.version ?? 3;
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );

  const manifest: string[] = [];
  const spine: string[] = [];
  spec.files.forEach((f, i) => {
    zip.file(`OEBPS/${f.name}`, xhtml(f.body));
    manifest.push(`<item id="f${i}" href="${esc(f.name)}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="f${i}"${f.nonLinear ? ' linear="no"' : ''}/>`);
  });

  let coverMeta = '';
  (spec.images ?? []).forEach((img, i) => {
    zip.file(`OEBPS/${img.name}`, img.data);
    const props = img.cover && version === 3 ? ' properties="cover-image"' : '';
    manifest.push(`<item id="img${i}" href="${esc(img.name)}" media-type="${img.mime}"${props}/>`);
    if (img.cover && version === 2) coverMeta = `<meta name="cover" content="img${i}"/>`;
  });

  zip.file('OEBPS/style.css', 'p { color: red; }');
  manifest.push('<item id="css" href="style.css" media-type="text/css"/>');

  let spineToc = '';
  if (spec.toc && version === 3) {
    zip.file('OEBPS/nav.xhtml', navDoc(spec.toc));
    manifest.push('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
  }
  if (spec.toc && version === 2) {
    zip.file('OEBPS/toc.ncx', ncxDoc(spec.toc));
    manifest.push('<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>');
    spineToc = ' toc="ncx"';
  }

  const meta = [
    spec.title !== undefined ? `<dc:title>${esc(spec.title)}</dc:title>` : '',
    spec.author !== undefined ? `<dc:creator>${esc(spec.author)}</dc:creator>` : '',
    spec.description !== undefined ? `<dc:description>${esc(spec.description)}</dc:description>` : '',
    coverMeta,
  ].join('\n    ');

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="${version}.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">test-book</dc:identifier>
    ${meta}
  </metadata>
  <manifest>
    ${manifest.join('\n    ')}
  </manifest>
  <spine${spineToc}>
    ${spine.join('\n    ')}
  </spine>
</package>`,
  );

  return zip.generateAsync({ type: 'nodebuffer' });
}
