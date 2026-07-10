const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let crcTable: number[] | null = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = Array.from({ length: 256 }, (_, index) => {
    let c = index;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return c >>> 0;
  });
  return crcTable;
}

function crc32(bytes: Uint8Array) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function isPng(bytes: Uint8Array) {
  return pngSignature.every((value, index) => bytes[index] === value);
}

function readUint32(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function makeTextChunk(keyword: string, value: string) {
  if (!keyword || keyword.includes("\0")) {
    throw new Error("Invalid PNG text keyword.");
  }

  const type = textEncoder.encode("tEXt");
  const data = textEncoder.encode(`${keyword}\0${value}`);
  const chunk = new Uint8Array(12 + data.length);
  writeUint32(chunk, 0, data.length);
  chunk.set(type, 4);
  chunk.set(data, 8);

  const crcBytes = new Uint8Array(type.length + data.length);
  crcBytes.set(type, 0);
  crcBytes.set(data, type.length);
  writeUint32(chunk, 8 + data.length, crc32(crcBytes));
  return chunk;
}

function bytesToDataUrl(bytes: Uint8Array, mimeType = "image/png") {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(offset, offset + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

async function dataUrlToBytes(dataUrl: string) {
  const response = await fetch(dataUrl);
  return new Uint8Array(await response.arrayBuffer());
}

export async function addPngTextMetadataToDataUrl(dataUrl: string, keyword: string, value: string) {
  const bytes = await dataUrlToBytes(dataUrl);
  return bytesToDataUrl(addPngTextMetadata(bytes, keyword, value));
}

export function addPngTextMetadata(bytes: Uint8Array, keyword: string, value: string) {
  if (!isPng(bytes)) {
    throw new Error("The selected file is not a PNG image.");
  }

  const chunk = makeTextChunk(keyword, value);
  let offset = pngSignature.length;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = textDecoder.decode(bytes.slice(offset + 4, offset + 8));
    if (type === "IEND") {
      const result = new Uint8Array(bytes.length + chunk.length);
      result.set(bytes.slice(0, offset), 0);
      result.set(chunk, offset);
      result.set(bytes.slice(offset), offset + chunk.length);
      return result;
    }
    offset += 12 + length;
  }

  throw new Error("PNG image is missing IEND chunk.");
}

export async function readPngTextMetadataFromFile(file: File, keyword: string) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return readPngTextMetadata(bytes, keyword);
}

export function readPngTextMetadata(bytes: Uint8Array, keyword: string) {
  if (!isPng(bytes)) {
    throw new Error("The selected file is not a PNG image.");
  }

  let offset = pngSignature.length;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = textDecoder.decode(bytes.slice(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (type === "tEXt") {
      const data = bytes.slice(dataStart, dataEnd);
      const separator = data.indexOf(0);
      if (separator > 0) {
        const foundKeyword = textDecoder.decode(data.slice(0, separator));
        if (foundKeyword === keyword) {
          return textDecoder.decode(data.slice(separator + 1));
        }
      }
    }

    if (type === "IEND") break;
    offset += 12 + length;
  }

  return null;
}
