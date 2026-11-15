import {isInRange} from './numeric-range.js';

/** @import {NumericRange} from './numeric-range.js'; */

const LATIN1_DECODER = new TextDecoder('latin1');
const UTF8_DECODER = new TextDecoder('utf8');

/** The null byte. */
const NUL = 0;

/**
 * Extracts a C-style, null-terminated string from the `buffer` beginning at
 * `offset`, optionally checking if the length falls outside the given `range`
 * when provided.
 * @param {Uint8Array} buffer
 * @param {number} offset
 * @param {NumericRange} [range]
 * @returns {Uint8Array}
 * @throws {TypeError} If the string is missing a null terminator.
 * @throws {RangeError} If the string falls outside the given `range`.
 */
export function getCString(buffer, offset, range) {
  const endIndex = buffer.indexOf(NUL, offset);
  if (endIndex < 0) {
    throw new TypeError('String missing null terminator');
  }
  if (range && !isInRange(endIndex - offset, range)) {
    throw new RangeError('String size out of bounds');
  }
  return buffer.subarray(offset, endIndex);
}

/**
 * Extracts a string from the `buffer` beginning at `offset`.
 * @param {Uint8Array} buffer
 * @param {number} offset
 * @returns {Uint8Array}
 * @throws {TypeError} If the string contains a null byte.
 */
export function getString(buffer, offset) {
  if (buffer.includes(NUL, offset)) {
    throw new TypeError('Unexpected null byte in string');
  }
  return buffer.subarray(offset);
}

/**
 * Decodes a Latin-1-encoded string from the given `buffer`.
 * @param {Uint8Array} buffer
 * @returns {string}
 */
export function decodeLatin1(buffer) {
  return LATIN1_DECODER.decode(buffer);
}

/**
 * Decodes a UTF-8-encoded string from the given `buffer`.
 * @param {Uint8Array} buffer
 * @returns {string}
 */
export function decodeUtf8(buffer) {
  return UTF8_DECODER.decode(buffer);
}
