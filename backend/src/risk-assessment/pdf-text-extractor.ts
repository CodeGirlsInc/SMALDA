import { inflateRawSync, inflateSync } from 'zlib';

/**
 * Minimal PDF content-stream text extractor.
 *
 * `pdf-lib` can read a PDF's structure but has no text extraction support,
 * and no full extractor (pdf-parse / pdfjs-dist) is available in this project.
 * This walks the raw streams, inflates FlateDecode content and reads the
 * strings drawn inside BT/ET text blocks. It deliberately returns `null` for
 * scanned PDFs, which have no text layer to analyse.
 */
export function extractTextFromPdfBuffer(buffer: Buffer): string | null {
  if (!buffer || buffer.length === 0) {
    return null;
  }
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return null;
  }

  const textChunks: string[] = [];
  for (const stream of readStreams(buffer)) {
    const text = readTextFromContent(stream.toString('latin1'));
    if (text) {
      textChunks.push(text);
    }
  }

  const fullText = textChunks.join('\n').replace(/\s+/g, ' ').trim();
  return fullText.length > 0 ? fullText : null;
}

function readStreams(buffer: Buffer): Buffer[] {
  const streams: Buffer[] = [];
  const streamToken = Buffer.from('stream');
  const endToken = Buffer.from('endstream');
  let cursor = 0;

  while (cursor < buffer.length) {
    const streamStart = buffer.indexOf(streamToken, cursor);
    if (streamStart === -1) {
      break;
    }

    let dataStart = streamStart + streamToken.length;
    if (buffer[dataStart] === 0x0d) dataStart++;
    if (buffer[dataStart] === 0x0a) dataStart++;

    const streamEnd = buffer.indexOf(endToken, dataStart);
    if (streamEnd === -1) {
      break;
    }

    let dataEnd = streamEnd;
    if (dataEnd > dataStart && buffer[dataEnd - 1] === 0x0a) dataEnd--;
    if (dataEnd > dataStart && buffer[dataEnd - 1] === 0x0d) dataEnd--;

    const preceding = buffer
      .subarray(Math.max(0, streamStart - 512), streamStart)
      .toString('latin1');
    const dictionaryStart = preceding.lastIndexOf('<<');
    const dictionary =
      dictionaryStart === -1 ? '' : preceding.slice(dictionaryStart);
    const decoded = decodeStream(buffer.subarray(dataStart, dataEnd), dictionary);
    if (decoded) {
      streams.push(decoded);
    }

    cursor = streamEnd + endToken.length;
  }

  return streams;
}

function decodeStream(raw: Buffer, dictionary: string): Buffer | null {
  if (/\/FlateDecode\b/.test(dictionary)) {
    try {
      return inflateSync(raw);
    } catch {
      try {
        return inflateRawSync(raw);
      } catch {
        return null;
      }
    }
  }

  if (/\/LZWDecode\b/.test(dictionary)) {
    return null;
  }

  return raw;
}

function readTextFromContent(content: string): string | null {
  const nonPrintable = content.replace(/[\x09\x0A\x0D\x20-\xFF]/g, '');
  if (nonPrintable.length > content.length * 0.1) {
    return null;
  }

  const blocks = content.match(/BT\b[\s\S]*?\bET/g) ?? [];
  const lines: string[] = [];

  for (const block of blocks) {
    const strings = readStrings(block);
    if (strings.length > 0) {
      lines.push(strings.join(' '));
    }
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

function readStrings(block: string): string[] {
  const strings: string[] = [];

  for (let i = 0; i < block.length; i++) {
    const char = block[i];

    if (char === '(') {
      let depth = 1;
      let raw = '';
      i++;
      while (i < block.length && depth > 0) {
        const current = block[i];
        if (current === '\\') {
          raw += current;
          i++;
          if (i < block.length) {
            raw += block[i];
            i++;
          }
          continue;
        }
        if (current === '(') depth++;
        if (current === ')') {
          depth--;
          if (depth === 0) break;
        }
        raw += current;
        i++;
      }
      if (depth === 0) {
        strings.push(decodeLiteralString(raw));
      }
      continue;
    }

    if (char === '<' && block[i + 1] !== '<') {
      const closing = block.indexOf('>', i + 1);
      if (closing === -1) break;
      const candidate = block.slice(i + 1, closing);
      if (/^[\s0-9a-f]*$/i.test(candidate) && candidate.trim().length > 0) {
        const hex = candidate.replace(/\s+/g, '');
        if (hex.length % 2 === 0) {
          strings.push(decodeHexString(hex));
          i = closing;
        }
      }
    }
  }

  return strings;
}

function decodeLiteralString(raw: string): string {
  let result = '';
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (char !== '\\') {
      result += char;
      continue;
    }

    const escaped = raw[++i];
    if (escaped === undefined) break;

    switch (escaped) {
      case 'n':
        result += '\n';
        break;
      case 'r':
        result += '\r';
        break;
      case 't':
        result += '\t';
        break;
      case 'b':
        result += '\b';
        break;
      case 'f':
        result += '\f';
        break;
      case '(':
      case ')':
      case '\\':
        result += escaped;
        break;
      case '\r':
        if (raw[i + 1] === '\n') i++;
        break;
      case '\n':
        break;
      default:
        if (/[0-7]/.test(escaped)) {
          let octal = escaped;
          while (octal.length < 3 && /[0-7]/.test(raw[i + 1] ?? '')) {
            octal += raw[++i];
          }
          result += String.fromCharCode(parseInt(octal, 8));
        } else {
          result += escaped;
        }
    }
  }
  return result;
}

function decodeHexString(hex: string): string {
  const bytes = Buffer.from(hex, 'hex');
  if (bytes.length === 0) {
    return '';
  }

  const isUtf16Be =
    (bytes[0] === 0xfe && bytes[1] === 0xff) ||
    bytes.slice(0, Math.min(bytes.length, 20)).some((byte) => byte === 0);
  if (!isUtf16Be) {
    return bytes.toString('latin1');
  }

  let result = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    result += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  }
  return result;
}
