import {BaseChunk, StandardChunkNameEnum} from './chunks/base-chunk.js';
import {TextChunk, TEXT_CHUNK_NAMES} from './chunks/text-chunk.js';

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

  /** @param {ArrayBuffer} buffer */
  constructor(buffer) {
    this.#textRecord = this.#parseTextRecord(buffer);
  }

  /** @returns {Blob} */
  toBlob() {
    throw new Error('Not yet implemented');
  }

  /**
   * Extracts all the text chunks in the image and merges them into a single
   * record.
   * @param {ArrayBuffer} buffer
   * @returns {Record<string, string>}
   */
  #parseTextRecord(buffer) {
    let offset = 0;
    this.#validateSignature(buffer);
    offset += SIGNATURE.byteLength;

    const chunkIterator = this.#getChunks(buffer, offset);
    consumeHeader(chunkIterator);

    /** @type {ReadonlySet<string>} */
    const allTextChunkNames = TEXT_CHUNK_NAMES.union(
      new Set([StandardChunkNameEnum.COMPRESSED_TEXT]),
    );

    /** @type {Record<string, string>} */
    const textRecord = {};
    for (
      let chunk = consumeUntil(chunkIterator, allTextChunkNames);
      !!chunk;
      chunk = consumeUntil(chunkIterator, allTextChunkNames)
    ) {
      if (chunk.type.name === StandardChunkNameEnum.COMPRESSED_TEXT) {
        console.debug('Skipping over compressed text chunk');
        continue;
      }

      const textChunk = new TextChunk(chunk);
      // TODO: Handle duplicate text chunk keywords.
      textRecord[textChunk.keyword] = textChunk.text;
    }

    return textRecord;
  }

  /**
   * Validates the buffer starts with the PNG signature.
   * @param {ArrayBuffer} buffer
   * @returns {void}
   */
  #validateSignature(buffer) {
    if (buffer.byteLength < SIGNATURE.byteLength) {
      throw new RangeError('Incomplete or missing file signature');
    }
    const putativeSignature = new Uint8Array(
      buffer,
      /* byteOffset= */ 0,
      SIGNATURE.byteLength,
    );
    if (!putativeSignature.every((x, i) => x === SIGNATURE[i])) {
      throw new TypeError('File signature does not match that of a PNG');
    }
  }

  /**
   * Iterates over the chunks in the `buffer`, starting at `offset`.
   * @param {ArrayBuffer} buffer
   * @param {number} offset
   * @yields {BaseChunk}
   */
  *#getChunks(buffer, offset) {
    while (offset < buffer.byteLength) {
      const chunk = new BaseChunk(buffer, offset);
      yield chunk;
      offset += chunk.size;
    }
    if (offset !== buffer.byteLength) {
      throw new RangeError('Unexpected data after reading chunks');
    }
  }
}

/**
 * Verifies the next chunk in `chunkIterator` is a header chunk and returns it.
 * @param {Iterator<BaseChunk>} chunkIterator
 * @returns {BaseChunk}
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
 */
function consumeUntil(chunkIterator, soughtNames) {
  for (
    let {value: chunk, done} = chunkIterator.next();
    chunk.type.name !== StandardChunkNameEnum.END;
    {value: chunk, done} = chunkIterator.next()
  ) {
    if (done) throw new Error('Unexpected end of input');
    if (soughtNames.has(chunk.type.name)) {
      return chunk;
    }
  }
  return undefined;
}
