import { supabase } from './supabase';
import { verifiedProfileIdentity } from './profileIdentity';

export const AVATAR_BUCKET = 'avatars';
export const AVATAR_SOURCE_MAX_MEBIBYTES = 10;
export const AVATAR_SOURCE_MAX_LABEL = `${AVATAR_SOURCE_MAX_MEBIBYTES} MB`;
export const AVATAR_SOURCE_MAX_BYTES = AVATAR_SOURCE_MAX_MEBIBYTES * 1024 * 1024;
export const AVATAR_OUTPUT_MAX_BYTES = 256 * 1024;
export const AVATAR_SOURCE_MAX_DIMENSION = 12_000;
export const AVATAR_SOURCE_MAX_PIXELS = 25_000_000;
export const AVATAR_OUTPUT_SIZE = 384;

const supportedSourceTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);
const heicSourceTypes = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);
const heicSequenceTypes = new Set(['image/heic-sequence', 'image/heif-sequence']);
const genericSourceTypes = new Set(['', 'application/octet-stream']);
const compressionQualities = [0.82, 0.72, 0.62, 0.52, 0.42];

export type AvatarState = {
  avatar_path: string | null;
  avatar_url: string | null;
  avatar_updated_at: string | null;
};

type SquareCrop = {
  sourceX: number;
  sourceY: number;
  sourceSize: number;
};

type AvatarDisplayFields = {
  avatar_path?: string | null;
  avatar_url?: string | null;
  avatar_updated_at?: string | null;
  updated_at?: string | null;
};

export function isHeicAvatarFile(file: Pick<File, 'name' | 'type'>) {
  if (heicSourceTypes.has(file.type.toLowerCase())) return true;
  return genericSourceTypes.has(file.type.toLowerCase()) && /\.hei[cf]$/i.test(file.name);
}

export function validateAvatarFile(file: Pick<File, 'name' | 'size' | 'type'>) {
  if (!supportedSourceTypes.has(file.type.toLowerCase()) && !isHeicAvatarFile(file)) {
    throw new Error('Choose a JPEG, PNG, WebP, HEIC, or HEIF image.');
  }
  if (file.size > AVATAR_SOURCE_MAX_BYTES) {
    throw new Error(`Choose an image that is ${AVATAR_SOURCE_MAX_LABEL} or smaller.`);
  }
  if (heicSequenceTypes.has(file.type.toLowerCase())) {
    throw new Error('Choose a single HEIC or HEIF photo, not an image sequence.');
  }
}

export function heicPixelDimensions(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const dimensions: Array<{ width: number; height: number }> = [];
  for (let typeOffset = 4; typeOffset + 16 <= view.byteLength; typeOffset += 1) {
    if (
      view.getUint8(typeOffset) !== 0x69 ||
      view.getUint8(typeOffset + 1) !== 0x73 ||
      view.getUint8(typeOffset + 2) !== 0x70 ||
      view.getUint8(typeOffset + 3) !== 0x65
    ) continue;
    const boxOffset = typeOffset - 4;
    const boxSize = view.getUint32(boxOffset);
    if (boxSize < 20 || boxOffset + boxSize > view.byteLength) continue;
    const width = view.getUint32(typeOffset + 8);
    const height = view.getUint32(typeOffset + 12);
    if (width > 0 && height > 0) dimensions.push({ width, height });
  }
  return dimensions;
}

export function validateHeicMetadata(buffer: ArrayBuffer) {
  const dimensions = heicPixelDimensions(buffer);
  if (dimensions.length === 0) throw new Error('This HEIC photo has no readable size metadata.');
  for (const { width, height } of dimensions) calculateSquareCrop(width, height);
  return dimensions;
}

export function calculateSquareCrop(width: number, height: number): SquareCrop {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Choose an image with valid dimensions.');
  }
  if (width > AVATAR_SOURCE_MAX_DIMENSION || height > AVATAR_SOURCE_MAX_DIMENSION || width * height > AVATAR_SOURCE_MAX_PIXELS) {
    throw new Error('Choose an image no larger than 25 megapixels.');
  }
  const sourceSize = Math.min(width, height);
  return {
    sourceX: (width - sourceSize) / 2,
    sourceY: (height - sourceSize) / 2,
    sourceSize
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('This browser could not prepare the image. Try another file.'));
    }, 'image/webp', quality);
  });
}

async function loadImage(source: Blob) {
  const objectUrl = URL.createObjectURL(source);
  const image = new Image();
  image.decoding = 'async';
  image.src = objectUrl;
  try {
    await image.decode();
    return {
      source: image as CanvasImageSource,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl)
    };
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error('This image could not be read. Try another file.');
  }
}

async function convertHeicToBitmap(file: File) {
  try {
    validateHeicMetadata(await file.arrayBuffer());
    const { heicTo, isHeic } = await import('heic-to/csp');
    if (!(await isHeic(file))) throw new Error('The file does not contain a HEIC image.');
    const bitmap = await heicTo({ blob: file, type: 'bitmap' });
    return {
      source: bitmap as CanvasImageSource,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close()
    };
  } catch (caught) {
    console.error('[avatar-heic-conversion]', caught);
    throw new Error('This HEIC photo could not be read. Try exporting it as JPEG.');
  }
}

async function loadAvatarImage(file: File) {
  try {
    return await loadImage(file);
  } catch (caught) {
    if (!isHeicAvatarFile(file)) throw caught;
    return convertHeicToBitmap(file);
  }
}

export async function prepareAvatarImage(file: File) {
  validateAvatarFile(file);
  const loaded = await loadAvatarImage(file);
  try {
    const crop = calculateSquareCrop(loaded.width, loaded.height);
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_OUTPUT_SIZE;
    canvas.height = AVATAR_OUTPUT_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the image. Try another file.');
    context.drawImage(
      loaded.source,
      crop.sourceX,
      crop.sourceY,
      crop.sourceSize,
      crop.sourceSize,
      0,
      0,
      AVATAR_OUTPUT_SIZE,
      AVATAR_OUTPUT_SIZE
    );

    let compressed: Blob | null = null;
    for (const quality of compressionQualities) {
      compressed = await canvasToBlob(canvas, quality);
      if (compressed.size <= AVATAR_OUTPUT_MAX_BYTES) return compressed;
    }
    throw new Error('This image stays too large after compression. Try a simpler photo.');
  } finally {
    loaded.release();
  }
}

async function verifyCurrentIdentity(expectedUserId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('You need to sign in first.');
  return verifiedProfileIdentity(expectedUserId, data.user.id);
}

function firstAvatarState(data: unknown): AvatarState {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== 'object' || !('avatar_path' in value) || !('avatar_updated_at' in value)) {
    throw new Error('The avatar update could not be confirmed.');
  }
  const row = value as { avatar_path?: unknown; avatar_updated_at?: unknown };
  return {
    avatar_path: typeof row.avatar_path === 'string' ? row.avatar_path : null,
    avatar_url: null,
    avatar_updated_at: typeof row.avatar_updated_at === 'string' ? row.avatar_updated_at : null
  };
}

export async function uploadMyAvatar(expectedUserId: string, file: File, onPrepared?: (compressed: Blob) => void) {
  const compressed = await prepareAvatarImage(file);
  onPrepared?.(compressed);
  await verifyCurrentIdentity(expectedUserId);

  const { data: reservedPath, error: reserveError } = await supabase.rpc('reserve_my_avatar_path');
  if (reserveError || typeof reservedPath !== 'string') {
    throw reserveError ?? new Error('The avatar upload path could not be reserved.');
  }

  await verifyCurrentIdentity(expectedUserId);
  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(reservedPath, compressed, {
    cacheControl: '3600',
    contentType: 'image/webp',
    upsert: true
  });
  if (uploadError) throw uploadError;

  await verifyCurrentIdentity(expectedUserId);
  const { data, error: confirmError } = await supabase.rpc('confirm_my_avatar_upload', { p_path: reservedPath });
  if (confirmError) throw confirmError;
  return firstAvatarState(data);
}

export async function removeMyAvatar(expectedUserId: string, avatarPath: string | null) {
  await verifyCurrentIdentity(expectedUserId);
  if (avatarPath) {
    const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath]);
    if (removeError) throw removeError;
    await verifyCurrentIdentity(expectedUserId);
  }

  const { data, error } = await supabase.rpc('clear_my_avatar_path', { p_path: avatarPath });
  if (error) throw error;
  return firstAvatarState(data);
}

export function resolveAvatarUrl(profile: AvatarDisplayFields) {
  if (profile.avatar_path) {
    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(profile.avatar_path);
    const revision = profile.avatar_updated_at ?? profile.updated_at;
    return revision ? `${data.publicUrl}?v=${encodeURIComponent(revision)}` : data.publicUrl;
  }
  if (!profile.avatar_url) return null;
  try {
    const parsed = new URL(profile.avatar_url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? profile.avatar_url : null;
  } catch {
    return null;
  }
}
