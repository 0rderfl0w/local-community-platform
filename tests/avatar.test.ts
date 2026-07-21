import { describe, expect, test } from 'bun:test';
import { calculateSquareCrop, isHeicAvatarFile, validateAvatarFile } from '@/lib/avatar';

const mebibyte = 1024 * 1024;

function fakeFile(type: string, size: number, name = 'avatar') {
  return { type, size, name } as File;
}

describe('native avatar preparation', () => {
  test('accepts supported source images at the 10 MB boundary', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']) {
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
      expect(() => validateAvatarFile(file)).not.toThrow();
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

  test('rejects images without usable dimensions', () => {
    expect(() => calculateSquareCrop(0, 100)).toThrow('valid dimensions');
    expect(() => calculateSquareCrop(Number.NaN, 100)).toThrow('valid dimensions');
  });

  test('rejects pathological image dimensions before drawing to canvas', () => {
    expect(() => calculateSquareCrop(12_001, 100)).toThrow('25 megapixels');
    expect(() => calculateSquareCrop(5_001, 5_000)).toThrow('25 megapixels');
  });
});
