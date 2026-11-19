import {crc} from '../crc.js';
import {decodeLatin1, encodeLatin1, encodeLatin1Into} from '../strings.js';

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
 *   'IHDR' | 'PLTE' | 'IDAT' | 'IEND' | 'tIME' | 'tEXt' | 'iTXt' | 'zTXt'
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

const CHUNK_LENGTH_SIZE = 4;
const CHUNK_TYPE_SIZE = 4;
const CHUNK_CRC_SIZE = 4;
const MIN_CHUNK_SIZE = CHUNK_LENGTH_SIZE + CHUNK_TYPE_SIZE + CHUNK_CRC_SIZE;
const MAX_CHUNK_DATA_LENGTH = 2 ** 31;
const CHUNK_TYPE_PROPERTY_MASK = 1 << 5;

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

  /** @type {(number | undefined)} */
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

  // TODO: Add tracking to invalidate cache whenever `data` changes.
  /** @returns {number} */
  get crc() {
    if (this.#crc !== undefined) return this.#crc;

    const buffer = new Uint8Array(CHUNK_TYPE_SIZE + this.#data.byteLength);
    encodeLatin1Into(this.#type.name, buffer);
    buffer.set(this.#data, CHUNK_TYPE_SIZE);
    return (this.#crc = crc(buffer));
  }

  /**
   * @param {string} name
   * @param {Uint8Array} data
   * @param {number} [crc]
   */
  constructor(name, data, crc) {
    this.#type = parseChunkType(name);
    this.#data = data;
    this.#length = data.byteLength;
    this.#crc = crc;
  }

  /**
   * Decodes a `BaseChunk` from the `buffer` beginning at the given
   * `byteOffset`.
   * @param {ArrayBuffer} buffer
   * @param {number} byteOffset
   * @returns {BaseChunk}
   * @throws {RangeError} If there is insufficient size in `buffer` beginning
   *     from `byteOffset` to decode a minimal chunk.
   * @throws {RangeError} When the given `buffer` is not fully consumed after
   *     decoding.
   */
  static decode(buffer, byteOffset) {
    return BaseChunk.#decode(buffer, byteOffset, /* checkFinished= */ true);
  }

  /**
   * Decodes a `BaseChunk` from the `buffer` beginning at the given
   * `byteOffset`.
   * @param {ArrayBuffer} buffer
   * @param {number} byteOffset
   * @returns {BaseChunk}
   * @throws {RangeError} If there is insufficient size in `buffer` beginning
   *     from `byteOffset` to decode a minimal chunk.
   */
  static decodeFrom(buffer, byteOffset) {
    return BaseChunk.#decode(buffer, byteOffset, /* checkFinished= */ false);
  }

  /**
   * Decodes a `BaseChunk` from the `buffer` beginning at the given
   * `byteOffset`.
   * @param {ArrayBuffer} buffer
   * @param {number} byteOffset
   * @param {boolean} checkFinished
   * @returns {BaseChunk}
   * @throws {RangeError} If there is insufficient size in `buffer` beginning
   *     from `byteOffset` to decode a minimal chunk.
   * @throws {RangeError} When the given `buffer` is not fully consumed after
   *     decoding and `checkFinished` is set.
   */
  static #decode(buffer, byteOffset, checkFinished) {
    if (buffer.byteLength - byteOffset < MIN_CHUNK_SIZE) {
      throw new RangeError('Insufficient buffer size');
    }

    const length = decodeDataLength(buffer, byteOffset);
    byteOffset += CHUNK_LENGTH_SIZE;

    const nameStart = byteOffset;
    const name = decodeLatin1(
      new Uint8Array(buffer, nameStart, CHUNK_TYPE_SIZE),
    );
    byteOffset += CHUNK_TYPE_SIZE;

    const data = new Uint8Array(buffer, byteOffset, length);
    byteOffset += length;

    const crc = decodeCrc(
      buffer,
      /* dataStart= */ nameStart,
      /* crcStart= */ byteOffset,
    );
    byteOffset += CHUNK_CRC_SIZE;

    if (checkFinished && byteOffset !== buffer.byteLength) {
      throw new RangeError('Unexpected data after reading chunks');
    }

    return new BaseChunk(name, data, crc);
  }
}

/**
 * Extracts the data length for the chunk from the `buffer` beginning at
 * `byteOffset`.
 * @param {ArrayBuffer} buffer
 * @param {number} [byteOffset=0]
 * @returns {number}
 * @throws {RangeError} If the chunk data length is out of bounds.
 * @throws {RangeError} If the chunk data length exceeds the remaining size of
 *     the buffer.
 */
function decodeDataLength(buffer, byteOffset = 0) {
  const dataLength = new DataView(
    buffer,
    byteOffset,
    CHUNK_LENGTH_SIZE,
  ).getUint32(0);

  if (dataLength > MAX_CHUNK_DATA_LENGTH) {
    throw new RangeError('Chunk data length too large');
  }
  if (buffer.byteLength - byteOffset - MIN_CHUNK_SIZE < dataLength) {
    throw new RangeError('Insufficient buffer size');
  }

  return dataLength;
}

/**
 * Parses the chunk type from the `name`.
 * @param {string} name
 * @returns {ChunkType}
 * @throws {RangeError} If the chunk type `name` is not exactly four letters.
 * @throws {TypeError} If the reserved bit is set, which is unsupported.
 */
function parseChunkType(name) {
  if (!/^[A-Za-z]{4}$/.test(name)) {
    throw new RangeError('Chunk type must consist of exactly four letters');
  }

  const bytes = encodeLatin1(name);
  if (bytes[2] & CHUNK_TYPE_PROPERTY_MASK) {
    throw new TypeError('Unsupported reserved bit');
  }

  return {
    name,
    ancillary: !!(bytes[0] & CHUNK_TYPE_PROPERTY_MASK),
    private: !!(bytes[1] & CHUNK_TYPE_PROPERTY_MASK),
    safeToCopy: !!(bytes[3] & CHUNK_TYPE_PROPERTY_MASK),
  };
}

/**
 * Extracts the CRC for the chunk from `buffer` beginning at `crcStart` against
 * the data leading up to it from `dataStart`.
 * @param {ArrayBuffer} buffer
 * @param {number} dataStart
 * @param {number} crcStart
 * @returns {number}
 * @throws {RangeError} When `dataStart` does not precede `crcStart` or either
 *     offset is out of bounds.
 * @throws {Error} If the chunk's CRC does not match.
 */
function decodeCrc(buffer, dataStart, crcStart) {
  if (dataStart >= crcStart) {
    throw new RangeError('CRC index must follow data index');
  }
  if (crcStart + CHUNK_CRC_SIZE > buffer.byteLength) {
    throw new RangeError('CRC index out of bounds');
  }

  const putativeCrc = new DataView(buffer, crcStart, CHUNK_CRC_SIZE).getUint32(
    0,
  );
  const chunkBytes = new Uint8Array(buffer, dataStart, crcStart - dataStart);
  const chunkCrc = crc(chunkBytes);
  if (putativeCrc !== chunkCrc) {
    throw new Error('CRC does not match chunk');
  }

  return putativeCrc;
}
