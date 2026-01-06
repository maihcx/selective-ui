/**
 * @typedef {Object} SizeObject
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} DimensionObject
 * @property {number} width
 * @property {number} height
 * @property {number} scrollHeight
 */

/**
 * @typedef {Object} EffectorInterface
 * @property {(query: string | HTMLElement) => void} setElement
 * @property {HTMLElement} element
 * @property {(object: {}) => EffectorInterface} expand
 * @property {() => EffectorInterface} cancel
 * @property {(object: {}) => EffectorInterface} collapse
 * @property {(object: {}) => EffectorInterface} resize
 * @property {boolean} isAnimating
 * @property {(string: "flex") => DimensionObject} getHiddenDimensions
 */