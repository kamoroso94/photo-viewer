import {StandardChunkNameEnum} from './base-chunk.js';

/** @import {NumericRange} from '../numeric-range.js'; */

/**
 * @typedef {object} TextChunk
 * @property {string} keyword
 * @property {string} text
 */

/** @type {NumericRange} */
export const KEYWORD_SIZE_RANGE = {min: 1, max: 79};

/** @type {ReadonlySet<string>} */
export const TEXT_CHUNK_NAMES = new Set([
  StandardChunkNameEnum.LATIN1_TEXT,
  StandardChunkNameEnum.COMPRESSED_TEXT,
  StandardChunkNameEnum.UTF8_TEXT,
]);
