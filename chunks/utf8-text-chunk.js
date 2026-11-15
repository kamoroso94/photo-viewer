import {StandardChunkNameEnum} from './base-chunk.js';
import {KEYWORD_SIZE_RANGE} from './text-chunk.js';
import {decodeLatin1, decodeUtf8, getCString, getString} from '../strings.js';

/**
 * @import {BaseChunk} from './base-chunk.js';
 * @import {TextChunk} from './text-chunk.js';
 */

// See https://www.libpng.org/pub/png/spec/1.2/PNG-Chunks.html#C.iTXt.
const MIN_CHUNK_DATA_SIZE = KEYWORD_SIZE_RANGE.min + 5;

/**
 * A UTF-8 text chunk of a PNG file.
 * @implements {TextChunk}
 */
export class Utf8TextChunk {
  /** @type {string} */
  #keyword;

  /** @type {(string | undefined)} */
  #languageTag;

  /** @type {(string | undefined)} */
  #translatedKeyword;

  /** @type {string} */
  #text;

  /** @type {string} */
  get keyword() {
    return this.#keyword;
  }

  /** @type {(string | undefined)} */
  get languageTag() {
    return this.#languageTag;
  }

  /** @type {(string | undefined)} */
  get translatedKeyword() {
    return this.#translatedKeyword;
  }

  /** @type {string} */
  get text() {
    return this.#text;
  }

  /**
   * @param {BaseChunk} chunk
   * @throws {TypeError} If `chunk` is not a UTF-8 text chunk.
   * @throws {RangeError} If there is insufficient size to decode the chunk
   *     data.
   */
  constructor(chunk) {
    if (chunk.type.name !== StandardChunkNameEnum.UTF8_TEXT) {
      throw new TypeError('Chunk is not a UTF-8 text chunk');
    }
    if (chunk.data.byteLength < MIN_CHUNK_DATA_SIZE) {
      throw new RangeError('Insufficient size for UTF-8 text chunk data');
    }

    let dataOffset = 0;

    const keywordBuffer = getCString(
      chunk.data,
      dataOffset,
      KEYWORD_SIZE_RANGE,
    );
    this.#keyword = decodeLatin1(keywordBuffer);
    // Skip over the null terminator.
    dataOffset += keywordBuffer.byteLength + 1;

    // TODO: Handle compressed text.
    const compressed = !!chunk.data[dataOffset];
    if (compressed) throw new Error('Compression not supported');
    // Skip over compression flag and compression method.
    dataOffset += 2;

    const languageTagBuffer = getCString(chunk.data, dataOffset);
    this.#languageTag = this.#parseLanguageTag(languageTagBuffer);
    // Skip over the null terminator.
    dataOffset += languageTagBuffer.byteLength + 1;

    const translatedKeywordBuffer = getCString(chunk.data, dataOffset);
    this.#translatedKeyword = translatedKeywordBuffer.length
      ? decodeUtf8(translatedKeywordBuffer)
      : undefined;
    // Skip over the null terminator.
    dataOffset += translatedKeywordBuffer.byteLength + 1;

    const textBuffer = getString(chunk.data, dataOffset);
    this.#text = decodeUtf8(textBuffer);
    dataOffset += textBuffer.byteLength;
  }

  /**
   * Reads the language tag stored in `buffer`.
   * @param {Uint8Array} buffer
   * @returns {(string | undefined)}
   * @throws {TypeError} If the language tag is invalid.
   */
  #parseLanguageTag(buffer) {
    if (!buffer.length) return undefined;

    const languageTag = decodeLatin1(buffer);
    if (/^[a-z]{1,8}(?:-[a-z]{1,8})*$/i.test(languageTag)) {
      throw new TypeError('Invalid language tag');
    }
    return languageTag;
  }
}
