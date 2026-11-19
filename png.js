import {BaseChunk, StandardChunkNameEnum} from './chunks/base-chunk.js';
import {Latin1TextChunk} from './chunks/latin1-text-chunk.js';
import {TEXT_CHUNK_NAMES} from './chunks/text-chunk.js';
import {Utf8TextChunk} from './chunks/utf8-text-chunk.js';

/** @import {TextChunk} from './chunks/text-chunk.js'; */

// See https://www.libpng.org/pub/png/spec/1.2/PNG-Structure.html#PNG-file-signature.
const SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

/** Handles reading PNG files. */
export class PNG {
  /**
   * A record of all the text chunks in this image.
   * @type {Record<string, string>}
   */
  #textRecord;

  /**
   * A record of all the text chunks in this image.
   * @returns {Readonly<Record<string, string>>}
   */
  get textRecord() {
    return this.#textRecord;
  }

  /** @param {Iterable<BaseChunk>} chunks */
  constructor(chunks) {
    this.#textRecord = this.#parseTextRecord(chunks);
  }

  /** @returns {Blob} */
  toBlob() {
    throw new Error('Not yet implemented');
  }

  /**
   * Extracts all the text chunks in the image and merges them into a single
   * record.
   * @param {Iterable<BaseChunk>} chunks
   * @returns {Record<string, string>}
   */
  #parseTextRecord(chunks) {
    const chunkIterator = Iterator.from(chunks);
    consumeHeader(chunkIterator);

    /** @type {Record<string, string>} */
    const textRecord = {};
    for (
      let chunk = consumeUntil(chunkIterator, TEXT_CHUNK_NAMES);
      !!chunk;
      chunk = consumeUntil(chunkIterator, TEXT_CHUNK_NAMES)
    ) {
      // TODO: Handle compressed text.
      if (chunk.type.name === StandardChunkNameEnum.COMPRESSED_TEXT) {
        console.debug('Skipping over compressed text chunk');
        continue;
      }

      /** @type {TextChunk} */
      const textChunk =
        chunk.type.name === StandardChunkNameEnum.LATIN1_TEXT
          ? new Latin1TextChunk(chunk)
          : new Utf8TextChunk(chunk);
      // TODO: Handle duplicate text chunk keywords.
      textRecord[textChunk.keyword] = textChunk.text;
    }

    return textRecord;
  }

  /**
   * Decodes a PNG from the `buffer` beginning at `byteOffset`.
   * @param {ArrayBuffer} buffer
   * @param {number} [byteOffset=0]
   * @returns {PNG}
   * @throws {RangeError} When the given `buffer` is not fully consumed after
   *     decoding.
   */
  static decode(buffer, byteOffset = 0) {
    return PNG.#decode(buffer, byteOffset, /* checkFinished= */ true);
  }

  /**
   * Decodes a PNG from the `buffer` beginning at `byteOffset`.
   * @param {ArrayBuffer} buffer
   * @param {number} [byteOffset=0]
   * @returns {PNG}
   */
  static decodeFrom(buffer, byteOffset = 0) {
    return PNG.#decode(buffer, byteOffset, /* checkFinished= */ false);
  }

  /**
   * Decodes a PNG from the `buffer` beginning at `byteOffset`.
   * @param {ArrayBuffer} buffer
   * @param {number} byteOffset
   * @param {boolean} checkFinished
   * @returns {PNG}
   * @throws {RangeError} When the given `buffer` is not fully consumed after
   *     decoding and `checkFinished` is set.
   */
  static #decode(buffer, byteOffset, checkFinished) {
    validateSignature(buffer, byteOffset);
    byteOffset += SIGNATURE.byteLength;

    return new PNG(decodeChunks(buffer, byteOffset, checkFinished));
  }
}

/**
 * Validates the `buffer` starts with the PNG signature at the given
 * `byteOffset`.
 * @param {ArrayBuffer} buffer
 * @param {number} byteOffset
 * @returns {void}
 * @throws {RangeError} If the PNG file signature is incomplete.
 * @throws {TypeError} If the PNG file signature does not match.
 */
function validateSignature(buffer, byteOffset) {
  if (buffer.byteLength - byteOffset < SIGNATURE.byteLength) {
    throw new RangeError('Incomplete or missing file signature');
  }
  const putativeSignature = new Uint8Array(
    buffer,
    byteOffset,
    SIGNATURE.byteLength,
  );
  if (!putativeSignature.every((x, i) => x === SIGNATURE[i])) {
    throw new TypeError('File signature does not match that of a PNG');
  }
}

/**
 * Iterates over the chunks in the `buffer`, starting at `byteOffset`.
 * @param {ArrayBuffer} buffer
 * @param {number} byteOffset
 * @param {boolean} checkFinished
 * @yields {BaseChunk}
 * @throws {RangeError} If data remains in `buffer` after parsing all chunks and
 *     `checkFinished` is set.
 */
function* decodeChunks(buffer, byteOffset, checkFinished) {
  while (byteOffset < buffer.byteLength) {
    const chunk = BaseChunk.decodeFrom(buffer, byteOffset);
    yield chunk;
    byteOffset += chunk.size;
  }
  if (checkFinished && byteOffset !== buffer.byteLength) {
    throw new RangeError('Unexpected data after reading chunks');
  }
}

/**
 * Verifies the next chunk in `chunkIterator` is a header chunk and returns it.
 * @param {Iterator<BaseChunk>} chunkIterator
 * @returns {BaseChunk}
 * @throws {TypeError} If there are no chunks.
 * @throws {SyntaxError} If the first chunk is not the header.
 */
function consumeHeader(chunkIterator) {
  const {value: chunk, done} = chunkIterator.next();
  if (done) throw new TypeError('Missing header chunk');
  if (chunk.type.name !== StandardChunkNameEnum.HEADER) {
    throw new SyntaxError('Expected header chunk');
  }
  return chunk;
}

/**
 * Consumes chunks from the `chunkIterator` until a chunk that matches the
 * `soughtNames` is found or the end chunk is reached, returning the found chunk
 * or undefined, respectively.
 * @param {Iterator<BaseChunk>} chunkIterator
 * @param {ReadonlySet<string>} soughtNames
 * @returns {(BaseChunk | undefined)}
 * @throws {SyntaxError} If the iterator finishes before encountering an end
 *     chunk.
 */
function consumeUntil(chunkIterator, soughtNames) {
  for (
    let {value: chunk, done} = chunkIterator.next();
    chunk.type.name !== StandardChunkNameEnum.END;
    {value: chunk, done} = chunkIterator.next()
  ) {
    if (done) throw new SyntaxError('Unexpected end of input');
    if (soughtNames.has(chunk.type.name)) {
      return chunk;
    }
  }
  return undefined;
}
