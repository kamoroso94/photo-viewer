import {StandardChunkNameEnum} from './base-chunk.js';

/**
 * @import {BaseChunk} from './base-chunk.js';
 * @import {NumericRange} from '../numeric-range.js';
 */

/** The null byte. */
const NUL = 0;

/** @type {NumericRange} */
const KEYWORD_SIZE_RANGE = {min: 1, max: 79};

// Include null terminator.
const MIN_TEXT_CHUNK_SIZE = KEYWORD_SIZE_RANGE.min + 1;

const LATIN1_DECODER = new TextDecoder('latin1');
const UTF8_DECODER = new TextDecoder('utf8');

/** @type {ReadonlySet<string>} */
export const TEXT_CHUNK_NAMES = new Set([
  StandardChunkNameEnum.LATIN1_TEXT,
  StandardChunkNameEnum.UTF8_TEXT,
]);

/** A textual chunk of a PNG file. */
export class TextChunk {
  /** @type {TextDecoder} */
  #decoder;

  /** @type {string} */
  #keyword;

  /** @type {string} */
  #text;

  /** @type {string} */
  get keyword() {
    return this.#keyword;
  }

  /** @type {string} */
  get text() {
    return this.#text;
  }

  /** @param {BaseChunk} chunk */
  constructor(chunk) {
    if (!TEXT_CHUNK_NAMES.has(chunk.type.name)) {
      throw new TypeError('Chunk is not a text chunk');
    }
    if (chunk.data.byteLength < MIN_TEXT_CHUNK_SIZE) {
      throw new RangeError('Insufficient chunk size for text');
    }

    this.#decoder =
      chunk.type.name === StandardChunkNameEnum.LATIN1_TEXT
        ? LATIN1_DECODER
        : UTF8_DECODER;

    let dataOffset = 0;

    const keywordBuffer = this.#parseKeyword(chunk.data);
    this.#keyword = this.#decoder.decode(keywordBuffer);
    dataOffset += keywordBuffer.byteLength;

    // Skip over the null terminator.
    dataOffset++;

    const textBuffer = this.#parseText(chunk.data, dataOffset);
    this.#text = this.#decoder.decode(textBuffer);
    dataOffset += textBuffer.byteLength;
  }

  /**
   * Extracts the keyword from the chunk data.
   * @param {Uint8Array} buffer
   * @returns {Uint8Array}
   */
  #parseKeyword(buffer) {
    const end = Math.min(buffer.byteLength, KEYWORD_SIZE_RANGE.max);
    const index = buffer.subarray(0, end).indexOf(NUL);
    if (index < 0) {
      throw new TypeError('String missing null terminator');
    }
    return buffer.subarray(0, index);
  }

  /**
   * Extracts the text from the chunk data.
   * @param {Uint8Array} buffer
   * @param {number} byteOffset
   * @returns {Uint8Array}
   */
  #parseText(buffer, byteOffset) {
    if (buffer.includes(NUL, byteOffset)) {
      throw new TypeError('Unexpected null byte in string');
    }
    return buffer.subarray(byteOffset);
  }
}
