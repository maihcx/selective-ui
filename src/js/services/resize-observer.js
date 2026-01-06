
/**
 * @class
 */
export class ResizeObserverService {
    isInit = false;
    element = null;
    /** @type {ResizeObserver} */
    #resizeObserver = null;
    #mutationObserver = null;
    #boundUpdateChanged;
    
    /**
     * Initializes the service and binds the internal update handler to `this`.
     * Sets the service to an initialized state.
     */
    constructor() {
        this.isInit = true
        this.#boundUpdateChanged = this.#updateChanged.bind(this);
    }

    /**
     * Callback invoked when the observed element's metrics change.
     * Override to react to size/position/style updates.
     *
     * @param {ElementMetrics} metrics - Calculated box metrics (size, position, padding, border, margin).
     */
    onChanged(metrics) {}

    /**
     * Computes the current metrics of the bound element (bounding rect + computed styles)
     * and forwards them to `onChanged(metrics)`.
     *
     * @returns {void}
     */
    #updateChanged() {
        // Guard: nếu element chưa sẵn sàng hoặc không đo được, trả về metrics mặc định
        const el = this.element;
        if (!el || typeof el.getBoundingClientRect !== 'function') {
            /** @type {ElementMetrics} */
            const defaultMetrics = {
                width: 0,
                height: 0,
                top: 0,
                left: 0,
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
                border:  { top: 0, right: 0, bottom: 0, left: 0 },
                margin:  { top: 0, right: 0, bottom: 0, left: 0 },
            };
            this.onChanged(defaultMetrics);
            return;
        }

        const rect = el.getBoundingClientRect();
        const style = (typeof window?.getComputedStyle === 'function')
            ? window.getComputedStyle(el)
            : null;

        /** @type {ElementMetrics} */
        const metrics = {
            width: rect?.width ?? 0,
            height: rect?.height ?? 0,
            top: rect?.top ?? 0,
            left: rect?.left ?? 0,

            padding: {
                top: parseFloat(style?.paddingTop ?? '0'),
                right: parseFloat(style?.paddingRight ?? '0'),
                bottom: parseFloat(style?.paddingBottom ?? '0'),
                left: parseFloat(style?.paddingLeft ?? '0'),
            },

            border: {
                top: parseFloat(style?.borderTopWidth ?? '0'),
                right: parseFloat(style?.borderRightWidth ?? '0'),
                bottom: parseFloat(style?.borderBottomWidth ?? '0'),
                left: parseFloat(style?.borderLeftWidth ?? '0'),
            },

            margin: {
                top: parseFloat(style?.marginTop ?? '0'),
                right: parseFloat(style?.marginRight ?? '0'),
                bottom: parseFloat(style?.marginBottom ?? '0'),
                left: parseFloat(style?.marginLeft ?? '0'),
            }
        };
        
        this.onChanged(metrics);
    }
    
    /**
     * Manually triggers a metrics computation and notification via `onChanged`.
     */
    trigger() {
        this.#updateChanged();
    }
    
    /**
     * Starts observing the provided element for resize and style/class mutations,
     * and listens to window/visualViewport scroll/resize to detect layout changes.
     *
     * @param {Element} element - The element to observe; must be a valid DOM Element.
     * @throws {Error} If `element` is not an instance of Element.
     */
    connect(element) {
        if (!(element instanceof Element)) {
            throw new Error("Element không hợp lệ");
        }

        this.element = element;

        this.#resizeObserver = new ResizeObserver(this.#boundUpdateChanged);
        this.#resizeObserver.observe(element);

        this.#mutationObserver = new MutationObserver(this.#boundUpdateChanged);
        this.#mutationObserver.observe(element, {
            attributes: true,
            attributeFilter: ["style", "class"]
        });

        window.addEventListener("scroll", this.#boundUpdateChanged, true);
        window.addEventListener("resize", this.#boundUpdateChanged);

        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", this.#boundUpdateChanged);
            window.visualViewport.addEventListener("scroll", this.#boundUpdateChanged);
        }
    }
    
    /**
     * Stops all observations and event listeners, resets the change handler,
     * and releases internal observer resources.
     */
    disconnect() {
        // Optional chaining để an toàn với mocks trong môi trường test
        this.#resizeObserver?.disconnect?.();
        this.#mutationObserver?.disconnect?.();

        this.onChanged = (metrics) => {};
        window.removeEventListener("scroll", this.#boundUpdateChanged, true);
        window.removeEventListener("resize", this.#boundUpdateChanged);

        if (window.visualViewport) {
            window.visualViewport.removeEventListener("resize", this.#boundUpdateChanged);
            window.visualViewport.removeEventListener("scroll", this.#boundUpdateChanged);
        }

        this.#resizeObserver = null;
        this.#mutationObserver = null;
        this.element = null;
    }
}