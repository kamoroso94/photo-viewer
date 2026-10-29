import {crc} from '../crc.js';
import {isInRange} from '../numeric-range.js';

/** @import {NumericRange} from '../numeric-range.js'; */

/**
 * Represents the type of chunk, including derived fields.
 * @typedef {object} ChunkType
 * @property {string} name
 * @property {boolean} ancillary
 * @property {boolean} private
 * @property {boolean} safeToCopy
 */

/**
 * Names of the standard chunks.
 * @typedef {(
 *   'IHDR' | 'PLTE' | 'IDAT' | 'IEND' | 'tIME' | 'tEXt' | 'zTXt' | 'iTXt'
 * )} StandardChunkName
 */

// See https://www.libpng.org/pub/png/spec/1.2/PNG-Chunks.html#C.Summary-of-standard-chunks.
/**
 * Names of the standard chunks.
 * @enum {StandardChunkName}
 */
export const StandardChunkNameEnum = /** @type {const} */ ({
  HEADER: 'IHDR',
  TIME: 'tIME',
  LATIN1_TEXT: 'tEXt',
  COMPRESSED_TEXT: 'zTXt',
  UTF8_TEXT: 'iTXt',
  END: 'IEND',
  /** @type {ReadonlySet<StandardChunkName>} */
  values: new Set(['IHDR', 'tIME', 'tEXt', 'zTXt', 'iTXt', 'IEND']),
});

const LATIN1_DECODER = new TextDecoder('latin1');

const CHUNK_LENGTH_SIZE = 4;
const CHUNK_TYPE_SIZE = 4;
const CHUNK_CRC_SIZE = 4;
const MIN_CHUNK_SIZE = CHUNK_LENGTH_SIZE + CHUNK_TYPE_SIZE + CHUNK_CRC_SIZE;
const MAX_CHUNK_DATA_LENGTH = 2 ** 31;
const CHUNK_TYPE_PROPERTY_MASK = 1 << 5;

/** @type {NumericRange} */
const CHUNK_TYPE_BYTE_LOWER_RANGE = {min: 65, max: 90};
/** @type {NumericRange} */
const CHUNK_TYPE_BYTE_UPPER_RANGE = {min: 97, max: 122};

/** Basic outline of a chunk in a PNG file. */
export class BaseChunk {
  /**
   * The length of the chunk's `#data` in bytes.
   * @type {number}
   */
  #length;

  /** @type {ChunkType} */
  #type;

  /** @type {Uint8Array} */
  #data;

  /** @type {number} */
  #crc;

  /**
   * The total size of this chunk in bytes.
   * @returns {number}
   */
  get size() {
    return MIN_CHUNK_SIZE + this.#length;
  }

  /** @returns {Readonly<ChunkType>} */
  get type() {
    return this.#type;
  }

  /** @returns {Uint8Array} */
  get data() {
    return this.#data;
  }

  /** @returns {number} */
  get crc() {
    return this.#crc;
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [offset=0]
   */
  constructor(buffer, offset = 0) {
    const view = new DataView(buffer, offset);
    if (view.byteLength < MIN_CHUNK_SIZE) {
      throw new RangeError('Insufficient buffer size');
    }

    let chunkOffset = 0;
    this.#length = this.#parseDataLength(view);
    chunkOffset += CHUNK_LENGTH_SIZE;

    this.#type = this.#parseType(view, chunkOffset);
    chunkOffset += CHUNK_TYPE_SIZE;

    this.#data = new Uint8Array(
      view.buffer,
      view.byteOffset + chunkOffset,
      this.#length,
    );
    chunkOffset += this.#length;

    this.#crc = this.#parseCrc(view, chunkOffset);
    chunkOffset += CHUNK_CRC_SIZE;
  }

  /**
   * Extracts the data length from the chunk.
   * @param {DataView} view
   * @returns {number}
   */
  #parseDataLength(view) {
    const dataLength = view.getUint32(0);
    if (dataLength > MAX_CHUNK_DATA_LENGTH) {
      throw new RangeError('Chunk data length too large');
    }
    if (view.byteLength - MIN_CHUNK_SIZE < dataLength) {
      throw new RangeError('Insufficient buffer size');
    }
    return dataLength;
  }

  /**
   * Extracts the chunk type.
   * @param {DataView} view
   * @param {number} byteOffset
   * @returns {ChunkType}
   */
  #parseType(view, byteOffset) {
    const bytes = new Uint8Array(
      view.buffer,
      view.byteOffset + byteOffset,
      CHUNK_TYPE_SIZE,
    );
    if (
      !bytes.every(
        (x) =>
          isInRange(x, CHUNK_TYPE_BYTE_LOWER_RANGE) ||
          isInRange(x, CHUNK_TYPE_BYTE_UPPER_RANGE),
      )
    ) {
      throw new RangeError('Chunk type bytes out of range');
    }

    if (bytes[2] & CHUNK_TYPE_PROPERTY_MASK) {
      throw new TypeError('Unsupported reserved bit');
    }

    return {
      name: LATIN1_DECODER.decode(bytes),
      ancillary: !!(bytes[0] & CHUNK_TYPE_PROPERTY_MASK),
      private: !!(bytes[1] & CHUNK_TYPE_PROPERTY_MASK),
      safeToCopy: !!(bytes[3] & CHUNK_TYPE_PROPERTY_MASK),
    };
  }

  /**
   * Extracts and checks the CRC for the chunk.
   * @param {DataView} view
   * @param {number} byteOffset
   * @returns {number}
   */
  #parseCrc(view, byteOffset) {
    const putativeCrc = view.getUint32(byteOffset);
    const chunkBytesSize = CHUNK_TYPE_SIZE + this.#length;
    const chunkBytes = new Uint8Array(
      view.buffer,
      view.byteOffset + CHUNK_LENGTH_SIZE,
      chunkBytesSize,
    );
    const chunkCrc = crc(chunkBytes);
    if (putativeCrc !== chunkCrc) {
      throw new Error('CRC does not match chunk');
    }

    return putativeCrc;
  }
}
