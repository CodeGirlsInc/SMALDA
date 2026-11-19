const ECC_CODEWORDS_PER_BLOCK: Readonly<Record<number, number>> = {
  1: 7,
  2: 10,
  3: 15,
  4: 20,
  5: 26,
  6: 18,
  7: 20,
  8: 24,
  9: 30,
  10: 18,
};

const NUM_BLOCKS: Readonly<Record<number, number>> = {
  1: 1,
  2: 1,
  3: 1,
  4: 1,
  5: 1,
  6: 2,
  7: 2,
  8: 2,
  9: 2,
  10: 4,
};

function getNumRawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function getAlignmentPatternPositions(version: number): number[] {
  if (version === 1) return [];
  const size = version * 4 + 17;
  const numAlign = Math.floor(version / 7) + 2;
  const step =
    (version === 32 ? 26 : Math.ceil((version * 4 + numAlign * 2 + 1) / (numAlign * 2 - 2)) * 2);
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

function galoisMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function reedSolomonDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = galoisMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = galoisMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    for (let i = 0; i < divisor.length; i += 1) {
      result[i] ^= galoisMultiply(divisor[i], factor);
    }
  }
  return result;
}

function utf8Bytes(text: string): number[] {
  const encoded = new TextEncoder().encode(text);
  return Array.from(encoded);
}

function encodeData(text: string, version: number): number[] {
  const dataCodewords =
    Math.floor(getNumRawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[version] * NUM_BLOCKS[version];
  const bytes = utf8Bytes(text);
  const bits: number[] = [];
  const append = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };

  append(4, 4);
  append(bytes.length, version <= 9 ? 8 : 16);
  for (const byte of bytes) append(byte, 8);
  append(0, Math.max(0, Math.min(4, dataCodewords * 8 - bits.length)));
  append(0, (8 - (bits.length % 8)) % 8);

  const result: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    result.push(byte);
  }
  for (let i = 0; result.length < dataCodewords; i += 1) {
    result.push(i % 2 === 0 ? 0xec : 0x11);
  }
  return result;
}

function interleaveCodewords(data: number[], version: number): number[] {
  const numBlocks = NUM_BLOCKS[version];
  const eccPerBlock = ECC_CODEWORDS_PER_BLOCK[version];
  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
  const shortDataLength = Math.floor(rawCodewords / numBlocks) - eccPerBlock;
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const divisor = reedSolomonDivisor(eccPerBlock);

  const blocks: Array<{ data: number[]; ecc: number[] }> = [];
  let offset = 0;
  for (let i = 0; i < numBlocks; i += 1) {
    const length = shortDataLength + (i < numShortBlocks ? 0 : 1);
    const blockData = data.slice(offset, offset + length);
    offset += length;
    blocks.push({ data: blockData, ecc: reedSolomonRemainder(blockData, divisor) });
  }

  const result: number[] = [];
  for (let i = 0; i < shortDataLength + 1; i += 1) {
    for (const block of blocks) {
      if (i < block.data.length) result.push(block.data[i]);
    }
  }
  for (let i = 0; i < eccPerBlock; i += 1) {
    for (const block of blocks) result.push(block.ecc[i]);
  }
  return result;
}

export function encodeQrCode(text: string): boolean[][] | null {
  const bytes = utf8Bytes(text);
  let version = 0;
  for (let candidate = 1; candidate <= 10; candidate += 1) {
    const limit =
      Math.floor(getNumRawDataModules(candidate) / 8) -
      ECC_CODEWORDS_PER_BLOCK[candidate] * NUM_BLOCKS[candidate];
    const overhead = candidate <= 9 ? 2 : 3;
    if (bytes.length + overhead <= limit) {
      version = candidate;
      break;
    }
  }
  if (!version) return null;

  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const setFunction = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };

  for (const [centerX, centerY] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ]) {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const x = centerX + dx;
        const y = centerY + dy;
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(x, y, distance !== 2 && distance !== 4);
      }
    }
  }

  for (let i = 8; i < size - 8; i += 1) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }

  const alignPositions = getAlignmentPatternPositions(version);
  for (let i = 0; i < alignPositions.length; i += 1) {
    for (let j = 0; j < alignPositions.length; j += 1) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === alignPositions.length - 1) ||
        (i === alignPositions.length - 1 && j === 0)
      ) {
        continue;
      }
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          setFunction(
            alignPositions[i] + dx,
            alignPositions[j] + dy,
            Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
          );
        }
      }
    }
  }

  const formatData = (1 << 3) | 0;
  let formatRemainder = formatData;
  for (let i = 0; i < 10; i += 1) {
    formatRemainder = (formatRemainder << 1) ^ ((formatRemainder >>> 9) * 0x537);
  }
  const formatBits = ((formatData << 10) | formatRemainder) ^ 0x5412;
  for (let i = 0; i <= 5; i += 1) setFunction(8, i, ((formatBits >>> i) & 1) !== 0);
  setFunction(8, 7, ((formatBits >>> 6) & 1) !== 0);
  setFunction(8, 8, ((formatBits >>> 7) & 1) !== 0);
  setFunction(7, 8, ((formatBits >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, ((formatBits >>> i) & 1) !== 0);
  for (let i = 0; i < 8; i += 1) {
    setFunction(size - 1 - i, 8, ((formatBits >>> i) & 1) !== 0);
  }
  for (let i = 8; i < 15; i += 1) {
    setFunction(8, size - 15 + i, ((formatBits >>> i) & 1) !== 0);
  }
  setFunction(8, size - 8, true);

  if (version >= 7) {
    let versionRemainder = version;
    for (let i = 0; i < 12; i += 1) {
      versionRemainder =
        (versionRemainder << 1) ^ ((versionRemainder >>> 11) * 0x1f25);
    }
    const versionBits = (version << 12) | versionRemainder;
    for (let i = 0; i < 18; i += 1) {
      const dark = ((versionBits >>> i) & 1) !== 0;
      setFunction(size - 11 + (i % 3), Math.floor(i / 3), dark);
      setFunction(Math.floor(i / 3), size - 11 + (i % 3), dark);
    }
  }

  const codewords = interleaveCodewords(encodeData(text, version), version);
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      const upward = ((right + 1) & 2) === 0;
      const y = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        if (isFunction[y][x]) continue;
        let dark = false;
        if (bitIndex < codewords.length * 8) {
          dark = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
        }
        bitIndex += 1;
        if ((x + y) % 2 === 0) dark = !dark;
        modules[y][x] = dark;
      }
    }
  }

  return modules;
}

export function qrCodeDataUri(text: string): string | null {
  const modules = encodeQrCode(text);
  if (!modules) return null;
  const size = modules.length;
  const quietZone = 4;
  const dimension = size + quietZone * 2;
  let path = "";
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (modules[y][x]) {
        path += `M${x + quietZone},${y + quietZone}h1v1h-1z`;
      }
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
