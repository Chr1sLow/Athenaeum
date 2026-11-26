// Reads a picture's pixel size from its header, without decoding it.

export interface Size {
  width: number;
  height: number;
}

/** Same limits the PDF importer uses for illustrations: anything smaller is an ornament or icon. */
const MIN_SIDE = 150;
const MIN_AREA = 60_000;

/** Width and height of a PNG, JPEG, GIF or WebP; null for other formats (e.g. SVG) or a damaged header. */
export function imageSize(data: Buffer): Size | null {
  if (data.length >= 24 && data.readUInt32BE(0) === 0x89504e47 && data.toString('latin1', 12, 16) === 'IHDR') {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (data.length >= 10 && data.toString('latin1', 0, 3) === 'GIF') {
    return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
  }
  if (data.length >= 30 && data.toString('latin1', 0, 4) === 'RIFF' && data.toString('latin1', 8, 12) === 'WEBP') {
    return webpSize(data);
  }
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8) return jpegSize(data);
  return null;
}

/** A picture too small to be an illustration or a cover. Pictures of unknown size are kept. */
export function isDecoration(data: Buffer): boolean {
  const size = imageSize(data);
  return !!size && (Math.min(size.width, size.height) < MIN_SIDE || size.width * size.height < MIN_AREA);
}

/** Walks the JPEG segments to the first frame header (SOF0-15, except DHT/JPG/DAC). */
function jpegSize(data: Buffer): Size | null {
  let at = 2;
  while (at + 9 <= data.length) {
    if (data[at] !== 0xff) return null;
    const marker = data[at + 1]!;
    if (marker === 0xff) {
      at++; // fill byte
      continue;
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: data.readUInt16BE(at + 5), width: data.readUInt16BE(at + 7) };
    }
    at += 2 + data.readUInt16BE(at + 2);
  }
  return null;
}

function webpSize(data: Buffer): Size | null {
  const chunk = data.toString('latin1', 12, 16);
  if (chunk === 'VP8X') return { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 };
  if (chunk === 'VP8 ') return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = data.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}
