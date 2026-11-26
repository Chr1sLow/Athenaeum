import type { BookFormat } from '@athenaeum/shared';
import JSZip from 'jszip';
import { parseEpub } from './epub.ts';
import { ImportError } from './errors.ts';
import { parsePdf } from './pdf.ts';
import type { ImportedBook } from './types.ts';

export { ImportError } from './errors.ts';

const UNSUPPORTED = 'Athenaeum can read EPUB or PDF files. This file is neither.';

export const MIME_TYPES: Record<BookFormat, string> = {
  epub: 'application/epub+zip',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

/** Detects the format from the file's bytes (not its name) and parses it. */
export async function importBook(data: Buffer, filename: string): Promise<{ format: BookFormat; book: ImportedBook }> {
  if (data.subarray(0, 5).toString('latin1') === '%PDF-') {
    return { format: 'pdf', book: await parsePdf(data, filename) };
  }
  if (data[0] === 0x50 && data[1] === 0x4b) {
    // A zip: EPUB if it has an EPUB container, otherwise some other zip-based format (e.g. Word).
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(data);
    } catch {
      throw new ImportError("This file isn't a valid EPUB (it couldn't be unzipped). It may be damaged or incomplete.");
    }
    if (!zip.file('META-INF/container.xml')) throw new ImportError(UNSUPPORTED, 415);
    return { format: 'epub', book: await parseEpub(data) };
  }
  throw new ImportError(UNSUPPORTED, 415);
}
