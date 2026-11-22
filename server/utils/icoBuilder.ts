/**
 * Builds a Windows .ico container supporting single or multi-size PNG payloads
 * (ICONDIR + ICONDIRENTRY[] + PNG buffers, supported on Windows Vista/7/10/11).
 */
export interface IcoPngImageInput {
  buffer: Buffer;
  width: number;
  height: number;
}

export function buildMultiSizeIcoFromPngs(images: IcoPngImageInput[]): Buffer {
  const valid = images.filter((img) => img.buffer.length > 0);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: 1 = Icon
  header.writeUInt16LE(valid.length, 4);

  const dirEntries: Buffer[] = [];
  let offset = header.length + valid.length * 16;

  for (const img of valid) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...valid.map((img) => img.buffer)]);
}

export function buildIcoFromPng(pngBuffer: Buffer, width = 192, height = 192): Buffer {
  return buildMultiSizeIcoFromPngs([{ buffer: pngBuffer, width, height }]);
}
