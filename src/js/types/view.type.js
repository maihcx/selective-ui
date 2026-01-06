/**
 * @template {Record<string, Element>} TTags
 * @typedef {Object} ViewContract
 *
 * @property {Element | null} parent
 * @property {MountViewResult<TTags> | null} view
 * @property {() => void} render
 * @property {<K extends keyof TTags>(tag: K) => TTags[K]} getTag
 * @property {() => TTags} getTags
 * @property {() => Element} getView
 */