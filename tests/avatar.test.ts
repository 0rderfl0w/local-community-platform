import { describe, expect, test } from 'bun:test';
import { calculateSquareCrop, isHeicAvatarFile, validateAvatarFile, validateHeicMetadata } from '@/lib/avatar';

const mebibyte = 1024 * 1024;

function fakeFile(type: string, size: number, name = 'avatar') {
  return { type, size, name } as File;
}

function bytes(...values: number[]) {
  return Uint8Array.from(values);
}

function ascii(value: string) {
  return Uint8Array.from([...value].map((character) => character.charCodeAt(0)));
}

function uint16(value: number) {
  return bytes((value >>> 8) & 0xff, value & 0xff);
}

function uint32(value: number) {
  return bytes((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

function concat(...parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function box(type: string, payload: Uint8Array) {
  return concat(uint32(payload.length + 8), ascii(type), payload);
}

function fullBox(version: number, payload: Uint8Array) {
  return concat(bytes(version, 0, 0, 0), payload);
}

function heicContainer(
  images: Array<{ width: number; height: number }>,
  options: { brand?: string; thumbnailItemId?: number } = {}
) {
  const brand = options.brand ?? 'heic';
  const ftyp = box('ftyp', concat(ascii(brand), uint32(0), ascii('mif1'), ascii(brand)));
  const entries = images.map((_, index) => box('infe', fullBox(2, concat(uint16(index + 1), uint16(0), ascii('hvc1'), bytes(0)))));
  const iinf = box('iinf', fullBox(0, concat(uint16(entries.length), ...entries)));
  const properties = images.map(({ width, height }) => box('ispe', fullBox(0, concat(uint32(width), uint32(height)))));
  const ipco = box('ipco', concat(...properties));
  const associations = images.map((_, index) => concat(uint16(index + 1), bytes(1, index + 1)));
  const ipma = box('ipma', fullBox(0, concat(uint32(associations.length), ...associations)));
  const iprp = box('iprp', concat(ipco, ipma));
  const pitm = box('pitm', fullBox(0, uint16(1)));
  const iref = options.thumbnailItemId
    ? box('iref', fullBox(0, box('thmb', concat(uint16(options.thumbnailItemId), uint16(1), uint16(1)))))
    : new Uint8Array();
  const meta = box('meta', fullBox(0, concat(pitm, iinf, iref, iprp)));
  const result = concat(ftyp, meta);
  return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength) as ArrayBuffer;
}

describe('native avatar preparation', () => {
  test('accepts supported source images at the 10 MB boundary', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']) {
      expect(() => validateAvatarFile(fakeFile(type, 10 * mebibyte))).not.toThrow();
    }
  });

  test('recognizes iPhone HEIC and HEIF files when browsers omit a useful MIME type', () => {
    for (const file of [
      fakeFile('image/heic', 1000, 'portrait.heic'),
      fakeFile('image/heif', 1000, 'portrait.heif'),
      fakeFile('image/heic-sequence', 1000, 'live-photo.heic'),
      fakeFile('image/heif-sequence', 1000, 'live-photo.heif'),
      fakeFile('', 1000, 'portrait.HEIC'),
      fakeFile('application/octet-stream', 1000, 'portrait.heif')
    ]) {
      expect(isHeicAvatarFile(file)).toBe(true);
      if (file.type.endsWith('-sequence')) expect(() => validateAvatarFile(file)).toThrow('single HEIC or HEIF photo');
      else expect(() => validateAvatarFile(file)).not.toThrow();
    }
    expect(isHeicAvatarFile(fakeFile('image/png', 1000, 'portrait.png'))).toBe(false);
  });

  test('rejects unsupported or oversized source images', () => {
    expect(() => validateAvatarFile(fakeFile('image/svg+xml', 1000, 'avatar.svg'))).toThrow('JPEG, PNG, WebP, HEIC, or HEIF');
    expect(() => validateAvatarFile(fakeFile('image/png', 10 * mebibyte + 1))).toThrow('10 MB or smaller');
  });

  test('centers landscape and portrait crops before resizing', () => {
    expect(calculateSquareCrop(1200, 800)).toEqual({ sourceX: 200, sourceY: 0, sourceSize: 800 });
    expect(calculateSquareCrop(800, 1200)).toEqual({ sourceX: 0, sourceY: 200, sourceSize: 800 });
    expect(calculateSquareCrop(640, 640)).toEqual({ sourceX: 0, sourceY: 0, sourceSize: 640 });
  });

  test('rejects images without usable or bounded dimensions', () => {
    expect(() => calculateSquareCrop(0, 100)).toThrow('valid dimensions');
    expect(() => calculateSquareCrop(Number.NaN, 100)).toThrow('valid dimensions');
    expect(() => calculateSquareCrop(12_001, 100)).toThrow('25 megapixels');
    expect(() => calculateSquareCrop(5_001, 5_000)).toThrow('25 megapixels');
  });

  test('parses the primary HEIC item before invoking the decoder', () => {
    expect(validateHeicMetadata(heicContainer([{ width: 4032, height: 3024 }]))).toEqual({
      width: 4032,
      height: 3024,
      displayableImageCount: 1
    });
    expect(validateHeicMetadata(heicContainer([
      { width: 4032, height: 3024 },
      { width: 320, height: 240 }
    ], { thumbnailItemId: 2 }))).toEqual({ width: 4032, height: 3024, displayableImageCount: 1 });
  });

  test('rejects malformed, oversized, sequence, and multi-image HEIC containers before decoding', () => {
    expect(() => validateHeicMetadata(heicContainer([{ width: 6000, height: 5000 }]))).toThrow('25 megapixels');
    expect(() => validateHeicMetadata(heicContainer([{ width: 4032, height: 3024 }], { brand: 'hevc' }))).toThrow('image sequence');
    expect(() => validateHeicMetadata(heicContainer([{ width: 4032, height: 3024 }, { width: 1200, height: 800 }]))).toThrow('multi-image file');
    expect(() => validateHeicMetadata(box('ispe', fullBox(0, concat(uint32(1), uint32(1)))).buffer as ArrayBuffer)).toThrow('valid HEIC or HEIF');
  });
});
