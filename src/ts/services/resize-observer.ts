import { ElementMetrics } from "../types/services/resize-observer.type";

/**
 * ResizeObserverService
 *
 * Lightweight DOM observation service that consolidates multiple layout-change signals
 * into a single `onChanged(metrics)` hook.
 *
 * This is a headless utility (no rendering). It binds to one DOM element at a time,
 * derives a normalized {@link ElementMetrics} snapshot, and emits it to consumers.
 *
 * ### Responsibility
 * - Observe one bound DOM element for layout-affecting changes.
 * - Normalize native signals into a consistent metrics payload:
 *   - `ResizeObserver` → element box size changes
 *   - `MutationObserver` (attributes: `style`, `class`) → style-driven layout changes
 *   - `window` scroll/resize → viewport/layout shifts
 *   - `visualViewport` scroll/resize (when available) → zoom/keyboard/viewport changes
 * - Compute and emit metrics:
 *   - geometry from `getBoundingClientRect()`
 *   - padding/border/margin from `getComputedStyle()` (when available)
 *
 * ### Lifecycle behavior (service-level)
 * - `constructor()` initializes internal state and binds a stable handler reference.
 * - `connect(element)` attaches observers/listeners and starts emitting metric updates.
 * - `trigger()` forces an immediate metric snapshot emission.
 * - `disconnect()` detaches observers/listeners, clears references, and disables further emissions.
 *
 * ### Internal vs external signals
 * - **Internal signals**: `ResizeObserver` and `MutationObserver` callbacks.
 * - **External signals**: `window` / `visualViewport` scroll/resize events.
 * All signals funnel through the same internal handler and produce the same {@link ElementMetrics}.
 *
 * ### No-op / fallback behavior
 * - If the bound element is missing or not measurable, a zeroed {@link ElementMetrics} object is emitted.
 * - `disconnect()` is tolerant to being called when not connected.
 *
 * ### Idempotency notes
 * - `disconnect()` is effectively idempotent (safe to call multiple times).
 * - `connect()` is **not** idempotent: repeated calls without `disconnect()` will add duplicate
 *   observers/listeners and may result in amplified callbacks.
 *
 * ### DOM / environment side effects
 * - Adds/removes global listeners on `window` and optionally `window.visualViewport`.
 * - Creates and disconnects `ResizeObserver` and `MutationObserver` instances.
 * - Does not mutate the observed element; only reads layout/style information.
 *
 * @see {@link ElementMetrics}
 */
export class ResizeObserverService {
    /**
     * Initialization flag set by the constructor.
     *
     * @remarks
     * This flag indicates the instance has been constructed and its internal handler bound.
     * It does **not** indicate that observers are currently attached (see {@link connect}).
     */
    public isInit = false;

    /**
     * The currently bound DOM element being observed.
     *
     * @remarks
     * Set by {@link connect} and cleared by {@link disconnect}.
     */
    public element: HTMLElement | null = null;

    /**
     * Underlying `ResizeObserver` instance.
     *
     * @remarks
     * Allocated on {@link connect}. Disconnected and nulled on {@link disconnect}.
     */
    private resizeObserver: ResizeObserver | null = null;

    /**
     * Underlying `MutationObserver` instance watching `style` and `class` attribute changes.
     *
     * @remarks
     * Allocated on {@link connect}. Disconnected and nulled on {@link disconnect}.
     */
    private mutationObserver: MutationObserver | null = null;

    /**
     * Stable, `this`-bound handler shared by observers and global event listeners.
     *
     * @remarks
     * A stable reference is required so `removeEventListener` can reliably detach listeners.
     */
    private boundUpdateChanged: () => void;

    /**
     * Creates the service and binds internal handlers.
     *
     * ### Behavior
     * - Sets {@link isInit} to `true`.
     * - Binds {@link updateChanged} to a stable function reference stored in {@link boundUpdateChanged}.
     *
     * @remarks
     * This constructor does not attach any DOM observers; observation begins at {@link connect}.
     */
    public constructor() {
        this.isInit = true;
        this.boundUpdateChanged = this.updateChanged.bind(this);
    }

    /**
     * Hook invoked whenever the service emits a new metrics snapshot.
     *
     * ### Contract
     * - Receives a fully shaped {@link ElementMetrics} object.
     * - Numeric values are parsed to numbers (CSS pixels).
     * - When no measurable element is bound, values are zeroed.
     *
     * @param metrics - Snapshot of geometry and box edges (padding/border/margin).
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public onChanged(metrics: ElementMetrics): void { }

    /**
     * Computes metrics for the current {@link element} and forwards them to {@link onChanged}.
     *
     * ### Computation
     * - `getBoundingClientRect()` → `width`, `height`, `top`, `left`
     * - `getComputedStyle()` (if available) → padding, border widths, margins
     *
     * ### Fallback behavior
     * - If `element` is null/invalid or lacks `getBoundingClientRect`, emits a zeroed metrics object.
     * - If `window.getComputedStyle` is unavailable, padding/border/margin values default to `0`.
     *
     * @remarks
     * This method is the single funnel for all observation signals (internal + external).
     */
    private updateChanged(): void {
        const el = this.element;

        if (!el || typeof el.getBoundingClientRect !== "function") {
            const defaultMetrics: ElementMetrics = {
                width: 0,
                height: 0,
                top: 0,
                left: 0,
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
                border: { top: 0, right: 0, bottom: 0, left: 0 },
                margin: { top: 0, right: 0, bottom: 0, left: 0 },
            };
            this.onChanged(defaultMetrics);
            return;
        }

        const rect = el.getBoundingClientRect();
        const style =
            typeof window !== "undefined" && typeof window.getComputedStyle === "function"
                ? window.getComputedStyle(el)
                : null;

        const metrics: ElementMetrics = {
            width: rect?.width ?? 0,
            height: rect?.height ?? 0,
            top: rect?.top ?? 0,
            left: rect?.left ?? 0,

            padding: {
                top: parseFloat(style?.paddingTop ?? "0"),
                right: parseFloat(style?.paddingRight ?? "0"),
                bottom: parseFloat(style?.paddingBottom ?? "0"),
                left: parseFloat(style?.paddingLeft ?? "0"),
            },

            border: {
                top: parseFloat(style?.borderTopWidth ?? "0"),
                right: parseFloat(style?.borderRightWidth ?? "0"),
                bottom: parseFloat(style?.borderBottomWidth ?? "0"),
                left: parseFloat(style?.borderLeftWidth ?? "0"),
            },

            margin: {
                top: parseFloat(style?.marginTop ?? "0"),
                right: parseFloat(style?.marginRight ?? "0"),
                bottom: parseFloat(style?.marginBottom ?? "0"),
                left: parseFloat(style?.marginLeft ?? "0"),
            },
        };

        this.onChanged(metrics);
    }

    /**
     * Manually emits a metrics snapshot for the current element.
     *
     * ### No-op / fallback behavior
     * - If not connected or element is not measurable, a zeroed metrics object is emitted.
     */
    public trigger(): void {
        this.updateChanged();
    }

    /**
     * Attaches observers and listeners to begin emitting metric updates for the given element.
     *
     * ### Observed signals
     * - `ResizeObserver` on the element
     * - `MutationObserver` on the element (attributes: `style`, `class`)
     * - `window`:
     *   - `scroll` (capture phase) to detect scroll-driven layout shifts
     *   - `resize` to detect viewport size changes
     * - `window.visualViewport` (when available):
     *   - `resize` and `scroll` for mobile zoom / virtual keyboard adjustments
     *
     * @param element - DOM element to observe. Must be an `Element`.
     * @throws {Error} If `element` is not an instance of `Element`.
     *
     * @remarks
     * Not idempotent. Call {@link disconnect} before calling `connect()` again to avoid duplicates.
     */
    public connect(element: HTMLElement): void {
        if (!(element instanceof HTMLElement)) {
            throw new Error("Invalid element");
        }

        this.element = element;

        this.resizeObserver = new ResizeObserver(this.boundUpdateChanged);
        this.resizeObserver.observe(element);

        this.mutationObserver = new MutationObserver(this.boundUpdateChanged);
        this.mutationObserver.observe(element, {
            attributes: true,
            attributeFilter: ["style", "class"],
        });

        window.addEventListener("scroll", this.boundUpdateChanged, true);
        window.addEventListener("resize", this.boundUpdateChanged);

        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", this.boundUpdateChanged);
            window.visualViewport.addEventListener("scroll", this.boundUpdateChanged);
        }
    }

    /**
     * Detaches all observers and listeners, clears internal references, and disables emissions.
     *
     * ### Behavior
     * - Disconnects `ResizeObserver` and `MutationObserver` (if present).
     * - Removes `window` / `visualViewport` listeners.
     * - Resets {@link onChanged} to a no-op to prevent callbacks after teardown.
     * - Clears {@link element} and releases observer instances for GC.
     *
     * ### Idempotency
     * - Safe to call multiple times (platform APIs tolerate redundant disconnect/removals).
     */
    public disconnect(): void {
        this.resizeObserver?.disconnect();
        this.mutationObserver?.disconnect();

        this.onChanged = (_metrics: ElementMetrics) => { };

        window.removeEventListener("scroll", this.boundUpdateChanged, true);
        window.removeEventListener("resize", this.boundUpdateChanged);

        if (window.visualViewport) {
            window.visualViewport.removeEventListener("resize", this.boundUpdateChanged);
            window.visualViewport.removeEventListener("scroll", this.boundUpdateChanged);
        }

        this.resizeObserver = null;
        this.mutationObserver = null;
        this.element = null;
    }
}