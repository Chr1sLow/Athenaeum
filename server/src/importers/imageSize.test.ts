import { describe, expect, it } from 'vitest';
import { PNG_1PX } from '../test/fixtures/epub.ts';
import { solidPng } from '../test/fixtures/pdf.ts';
import { imageSize, isDecoration } from './imageSize.ts';

/** A JPEG cut off after its frame header, which is all imageSize reads. */
function jpegHeader(width: number, height: number, sof = 0xc0): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const frame = Buffer.alloc(19);
  frame.set([0xff, sof, 0x00, 0x11, 0x08]);
  frame.writeUInt16BE(height, 5);
  frame.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, frame]);
}

function gifHeader(width: number, height: number): Buffer {
  const b = Buffer.alloc(13);
  b.write('GIF89a', 0, 'ascii');
  b.writeUInt16LE(width, 6);
  b.writeUInt16LE(height, 8);
  return b;
}

function webpVp8x(width: number, height: number): Buffer {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'ascii');
  b.write('WEBPVP8X', 8, 'ascii');
  b.writeUIntLE(width - 1, 24, 3);
  b.writeUIntLE(height - 1, 27, 3);
  return b;
}

describe('imageSize', () => {
  it('reads a PNG', () => {
    expect(imageSize(solidPng(300, 450, [0, 0, 0]))).toEqual({ width: 300, height: 450 });
    expect(imageSize(PNG_1PX)).toEqual({ width: 1, height: 1 });
  });

  it('reads a baseline and a progressive JPEG', () => {
    expect(imageSize(jpegHeader(640, 960))).toEqual({ width: 640, height: 960 });
    expect(imageSize(jpegHeader(800, 1200, 0xc2))).toEqual({ width: 800, height: 1200 });
  });

  it('reads a GIF', () => {
    expect(imageSize(gifHeader(32, 16))).toEqual({ width: 32, height: 16 });
  });

  it('reads an extended WebP', () => {
    expect(imageSize(webpVp8x(1000, 1500))).toEqual({ width: 1000, height: 1500 });
  });

  it('returns null for anything else', () => {
    expect(imageSize(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(imageSize(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
  });
});

describe('isDecoration', () => {
  it('flags small pictures such as ornaments and icons', () => {
    expect(isDecoration(PNG_1PX)).toBe(true);
    expect(isDecoration(gifHeader(120, 40))).toBe(true);
  });

  it('keeps real pictures, and pictures whose size it cannot tell', () => {
    expect(isDecoration(solidPng(300, 450, [0, 0, 0]))).toBe(false);
    expect(isDecoration(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe(false);
  });
});
