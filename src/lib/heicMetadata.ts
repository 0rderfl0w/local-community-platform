const MAX_BOXES = 4_096;
const MAX_ITEMS = 512;
const MAX_PROPERTIES = 512;

const stillBrands = new Set(['heic', 'heix', 'mif1']);
const sequenceBrands = new Set(['hevc', 'hevx', 'msf1']);
const displayableItemTypes = new Set(['hvc1', 'grid', 'iden', 'iovl']);

type Box = {
  type: string;
  dataStart: number;
  end: number;
};

type HeicMetadata = {
  width: number;
  height: number;
  displayableImageCount: number;
};

function text(view: DataView, offset: number) {
  if (offset < 0 || offset + 4 > view.byteLength) throw new Error('This HEIC photo has invalid metadata.');
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

function parseBoxes(view: DataView, start: number, end: number) {
  const boxes: Box[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    if (boxes.length >= MAX_BOXES) throw new Error('This HEIC photo contains too many metadata boxes.');
    const compactSize = view.getUint32(offset);
    const type = text(view, offset + 4);
    let headerSize = 8;
    let size = compactSize;
    if (compactSize === 1) {
      if (offset + 16 > end) throw new Error('This HEIC photo has invalid metadata.');
      const largeSize = view.getBigUint64(offset + 8);
      if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('This HEIC photo is too large to inspect safely.');
      size = Number(largeSize);
      headerSize = 16;
    } else if (compactSize === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) throw new Error('This HEIC photo has invalid metadata.');
    boxes.push({ type, dataStart: offset + headerSize, end: offset + size });
    offset += size;
  }
  if (offset !== end) throw new Error('This HEIC photo has invalid metadata.');
  return boxes;
}

function fullBoxVersion(view: DataView, box: Box) {
  if (box.dataStart + 4 > box.end) throw new Error('This HEIC photo has invalid metadata.');
  return view.getUint8(box.dataStart);
}

function itemId(view: DataView, offset: number, wide: boolean, end: number) {
  const size = wide ? 4 : 2;
  if (offset + size > end) throw new Error('This HEIC photo has invalid metadata.');
  return { value: wide ? view.getUint32(offset) : view.getUint16(offset), next: offset + size };
}

function parsePrimaryItemId(view: DataView, pitm: Box) {
  const version = fullBoxVersion(view, pitm);
  return itemId(view, pitm.dataStart + 4, version > 0, pitm.end).value;
}

function parseItemTypes(view: DataView, iinf: Box) {
  const version = fullBoxVersion(view, iinf);
  let offset = iinf.dataStart + 4;
  const countSize = version === 0 ? 2 : 4;
  if (offset + countSize > iinf.end) throw new Error('This HEIC photo has invalid metadata.');
  const entryCount = countSize === 2 ? view.getUint16(offset) : view.getUint32(offset);
  if (entryCount > MAX_ITEMS) throw new Error('This HEIC photo contains too many image items.');
  offset += countSize;
  const entries = parseBoxes(view, offset, iinf.end);
  if (entries.length < entryCount) throw new Error('This HEIC photo has incomplete item metadata.');
  const types = new Map<number, string>();
  for (const entry of entries.slice(0, entryCount)) {
    if (entry.type !== 'infe') continue;
    const entryVersion = fullBoxVersion(view, entry);
    if (entryVersion < 2 || entryVersion > 3) continue;
    let cursor = entry.dataStart + 4;
    const parsedId = itemId(view, cursor, entryVersion === 3, entry.end);
    cursor = parsedId.next;
    if (cursor + 6 > entry.end) throw new Error('This HEIC photo has invalid item metadata.');
    cursor += 2;
    types.set(parsedId.value, text(view, cursor));
  }
  return types;
}

function parseProperties(view: DataView, ipco: Box) {
  const boxes = parseBoxes(view, ipco.dataStart, ipco.end);
  if (boxes.length > MAX_PROPERTIES) throw new Error('This HEIC photo contains too many image properties.');
  const dimensions = new Map<number, { width: number; height: number }>();
  boxes.forEach((box, index) => {
    if (box.type !== 'ispe') return;
    fullBoxVersion(view, box);
    const offset = box.dataStart + 4;
    if (offset + 8 > box.end) throw new Error('This HEIC photo has invalid size metadata.');
    const width = view.getUint32(offset);
    const height = view.getUint32(offset + 4);
    if (width > 0 && height > 0) dimensions.set(index + 1, { width, height });
  });
  return dimensions;
}

function parseAssociations(view: DataView, ipma: Box) {
  const version = fullBoxVersion(view, ipma);
  const flags = (view.getUint8(ipma.dataStart + 1) << 16) | (view.getUint8(ipma.dataStart + 2) << 8) | view.getUint8(ipma.dataStart + 3);
  let offset = ipma.dataStart + 4;
  if (offset + 4 > ipma.end) throw new Error('This HEIC photo has invalid property metadata.');
  const entryCount = view.getUint32(offset);
  if (entryCount > MAX_ITEMS) throw new Error('This HEIC photo contains too many image items.');
  offset += 4;
  const associations = new Map<number, number[]>();
  for (let entry = 0; entry < entryCount; entry += 1) {
    const parsedId = itemId(view, offset, version >= 1, ipma.end);
    offset = parsedId.next;
    if (offset + 1 > ipma.end) throw new Error('This HEIC photo has invalid property metadata.');
    const associationCount = view.getUint8(offset);
    offset += 1;
    if (associationCount > MAX_PROPERTIES) throw new Error('This HEIC photo contains too many image properties.');
    const propertyIndexes: number[] = [];
    for (let association = 0; association < associationCount; association += 1) {
      const wide = (flags & 1) !== 0;
      const size = wide ? 2 : 1;
      if (offset + size > ipma.end) throw new Error('This HEIC photo has invalid property metadata.');
      const raw = wide ? view.getUint16(offset) : view.getUint8(offset);
      offset += size;
      const propertyIndex = raw & (wide ? 0x7fff : 0x7f);
      if (propertyIndex > 0) propertyIndexes.push(propertyIndex);
    }
    associations.set(parsedId.value, propertyIndexes);
  }
  return associations;
}

function parseExcludedItems(view: DataView, iref: Box | undefined) {
  const excluded = new Set<number>();
  if (!iref) return excluded;
  const version = fullBoxVersion(view, iref);
  const references = parseBoxes(view, iref.dataStart + 4, iref.end);
  for (const reference of references) {
    let offset = reference.dataStart;
    const from = itemId(view, offset, version > 0, reference.end);
    offset = from.next;
    if (offset + 2 > reference.end) throw new Error('This HEIC photo has invalid reference metadata.');
    const referenceCount = view.getUint16(offset);
    if (referenceCount > MAX_ITEMS) throw new Error('This HEIC photo contains too many image references.');
    offset += 2;
    const targets: number[] = [];
    for (let index = 0; index < referenceCount; index += 1) {
      const target = itemId(view, offset, version > 0, reference.end);
      targets.push(target.value);
      offset = target.next;
    }
    if (reference.type === 'dimg') targets.forEach((id) => excluded.add(id));
    if (reference.type === 'thmb' || reference.type === 'auxl') excluded.add(from.value);
  }
  return excluded;
}

export function parseHeicMetadata(buffer: ArrayBuffer): HeicMetadata {
  const view = new DataView(buffer);
  const topLevel = parseBoxes(view, 0, view.byteLength);
  const ftyp = topLevel.find((box) => box.type === 'ftyp');
  const meta = topLevel.find((box) => box.type === 'meta');
  if (!ftyp || !meta || ftyp.dataStart + 8 > ftyp.end) throw new Error('This file is not a valid HEIC or HEIF image.');

  const brands = new Set([text(view, ftyp.dataStart)]);
  for (let offset = ftyp.dataStart + 8; offset + 4 <= ftyp.end; offset += 4) brands.add(text(view, offset));
  if ([...brands].some((brand) => sequenceBrands.has(brand))) throw new Error('Choose a single HEIC or HEIF photo, not an image sequence.');
  if (![...brands].some((brand) => stillBrands.has(brand))) throw new Error('This file is not a supported HEIC or HEIF image.');

  fullBoxVersion(view, meta);
  const metaBoxes = parseBoxes(view, meta.dataStart + 4, meta.end);
  const pitm = metaBoxes.find((box) => box.type === 'pitm');
  const iinf = metaBoxes.find((box) => box.type === 'iinf');
  const iprp = metaBoxes.find((box) => box.type === 'iprp');
  if (!pitm || !iinf || !iprp) throw new Error('This HEIC photo has incomplete image metadata.');

  const primaryItemId = parsePrimaryItemId(view, pitm);
  const itemTypes = parseItemTypes(view, iinf);
  const propertyBoxes = parseBoxes(view, iprp.dataStart, iprp.end);
  const ipco = propertyBoxes.find((box) => box.type === 'ipco');
  const ipma = propertyBoxes.find((box) => box.type === 'ipma');
  if (!ipco || !ipma) throw new Error('This HEIC photo has incomplete image properties.');

  const dimensions = parseProperties(view, ipco);
  const associations = parseAssociations(view, ipma);
  const primaryDimensions = (associations.get(primaryItemId) ?? [])
    .map((propertyIndex) => dimensions.get(propertyIndex))
    .find((value): value is { width: number; height: number } => Boolean(value));
  if (!primaryDimensions) throw new Error('This HEIC photo has no readable primary-image dimensions.');

  const excluded = parseExcludedItems(view, metaBoxes.find((box) => box.type === 'iref'));
  const displayableItems = [...itemTypes.entries()]
    .filter(([, type]) => displayableItemTypes.has(type))
    .map(([id]) => id)
    .filter((id) => !excluded.has(id));
  if (!displayableItems.includes(primaryItemId) || displayableItems.length !== 1) {
    throw new Error('Choose a single HEIC or HEIF photo, not a multi-image file.');
  }

  return { ...primaryDimensions, displayableImageCount: displayableItems.length };
}
