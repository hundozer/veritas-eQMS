import { inflateSync } from 'node:zlib';

// Text drawn with pdf-lib's standard fonts, read back from the compressed page
// streams, so tests can check what a generated PDF says.
export function pdfText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes);
  const text: string[] = [];
  let from = 0;
  for (;;) {
    const start = raw.indexOf('stream', from, 'latin1');
    if (start < 0) break;
    const bodyStart = raw[start + 6] === 0x0d ? start + 8 : start + 7;
    const end = raw.indexOf('endstream', bodyStart, 'latin1');
    if (end < 0) break;
    from = end + 9;
    let decoded: string;
    try {
      decoded = inflateSync(raw.subarray(bodyStart, end)).toString('latin1');
    } catch {
      continue;
    }
    for (const match of decoded.matchAll(/<([0-9A-Fa-f]+)> Tj/g)) {
      text.push(Buffer.from(match[1], 'hex').toString('latin1'));
    }
  }
  return text.join('\n');
}
