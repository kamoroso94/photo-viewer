/**
 * Represents an inclusive range of numbers.
 * @typedef {object} NumericRange
 * @property {number} min
 * @property {number} max
 */

/**
 * Determines whether the `value` is within the given `range`.
 * @param {number} value
 * @param {NumericRange} range
 */
export function isInRange(value, {min, max}) {
  return value >= min && value <= max;
}
