import {StandardChunkNameEnum} from './base-chunk.js';
import {KEYWORD_SIZE_RANGE} from './text-chunk.js';
import {decodeLatin1, getCString, getString} from '../strings.js';

/**
 * @import {BaseChunk} from './base-chunk.js';
 * @import {TextChunk} from './text-chunk.js';
 */

// See https://www.libpng.org/pub/png/spec/1.2/PNG-Chunks.html#C.tEXt.
const MIN_CHUNK_DATA_SIZE = KEYWORD_SIZE_RANGE.min + 1;

/**
 * A Latin-1 text chunk of a PNG file.
 * @implements {TextChunk}
 */
export class Latin1TextChunk {
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

  /**
   * @param {BaseChunk} chunk
   * @throws {TypeError} If `chunk` is not a Latin-1 text chunk.
   * @throws {RangeError} If there is insufficient size to decode the chunk
   *     data.
   */
  constructor(chunk) {
    if (chunk.type.name !== StandardChunkNameEnum.LATIN1_TEXT) {
      throw new TypeError('Chunk is not a Latin-1 text chunk');
    }
    if (chunk.data.byteLength < MIN_CHUNK_DATA_SIZE) {
      throw new RangeError('Insufficient size for Latin-1 text chunk data');
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

    const textBuffer = getString(chunk.data, dataOffset);
    this.#text = decodeLatin1(textBuffer);
    dataOffset += textBuffer.byteLength;
  }
}
