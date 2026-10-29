const UINT8_MASK = 0xff;
const UINT32_MASK = 0xffff_ffff;

/**
 * Truncates `x` to an unsigned 8-bit integer.
 * @param {number} x
 * @returns {number}
 */
function asUint8(x) {
  return x & UINT8_MASK;
}

/**
 * Truncates `x` to an unsigned 32-bit integer.
 * @param {number} x
 * @returns {number}
 */
function asUint32(x) {
  return (x & UINT32_MASK) >>> 0;
}

// See https://www.libpng.org/pub/png/spec/1.2/PNG-CRCAppendix.html#CRCAppendix.
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < CRC_TABLE.length; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = asUint32(0xedb88320 ^ (c >>> 1));
    } else {
      c >>>= 1;
    }
  }
  CRC_TABLE[n] = c;
}

/**
 * Computes the CRC for the given `buffer`.
 * @param {Uint8Array} buffer The data to process.
 * @returns {number}
 */
export function crc(buffer) {
  let crc = UINT32_MASK;
  for (const byte of buffer) {
    crc = asUint32(CRC_TABLE[asUint8(crc ^ byte)] ^ (crc >>> 8));
  }
  return asUint32(crc ^ UINT32_MASK);
}
