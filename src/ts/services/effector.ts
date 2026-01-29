import type {
    CollapseConfig,
    DimensionObject,
    EffectorInterface,
    ExpandConfig,
    ResizeConfig,
    SwipeConfig,
} from "../types/services/effector.type";

/**
 * Creates an {@link EffectorInterface} bound to a target element (optional).
 *
 * This is a small DOM utility that encapsulates common expand/collapse/resize/swipe animations
 * by applying inline styles + CSS transitions and coordinating them with `requestAnimationFrame`
 * and `setTimeout`.
 *
 * ### Responsibility
 * - Provide a chainable animation controller for a single HTMLElement.
 * - Coordinate transition setup and teardown using timeouts (not `transitionend` events).
 * - Expose an `isAnimating` flag for coarse-grained state checks.
 *
 * ### Binding contract
 * - If `query` is provided, it is resolved immediately via {@link EffectorImpl.setElement}.
 * - If `query` is omitted or null, the returned effector must be bound later via `setElement`
 *   before animation methods can take effect (they will otherwise no-op).
 *
 * @param query - CSS selector or element to control. When `null`, the effector is unbound.
 * @returns An effector instance implementing {@link EffectorInterface}.
 */
export function Effector(query?: string | HTMLElement | null): EffectorInterface {
    return new EffectorImpl(query ?? null);
}

/**
 * Internal implementation of {@link EffectorInterface}.
 *
 * This class performs DOM mutations (inline styles + class toggles) to animate a target element.
 * It is intentionally imperative and does not manage layout or state outside of animation concerns.
 *
 * ### Timing model
 * - Uses `requestAnimationFrame` to ensure initial styles are applied before starting transitions.
 * - Uses `setTimeout(duration)` to finalize state and call `onComplete`.
 *   (i.e., completion is time-based, not event-based.)
 *
 * @implements EffectorInterface
 * @internal
 */
class EffectorImpl implements EffectorInterface {
    /**
     * Target element controlled by this effector.
     *
     * Note: This is assigned via {@link setElement}. If unset, animation methods are no-ops.
     */
    public element!: HTMLElement;

    /**
     * Timeout used to finalize expand/collapse/swipe animations.
     * Cleared by {@link cancel}.
     */
    private timeOut: ReturnType<typeof setTimeout> | null = null;

    /**
     * Timeout used to clear transitions after resize in non-animated scenarios.
     * Cleared by {@link cancel}.
     */
    private resizeTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * Internal animation flag set while a timed animation is in-flight.
     *
     * Exposed via {@link isAnimating}. Reset by {@link cancel} and when animations complete.
     */
    private _isAnimating = false;

    /**
     * Creates an effector instance optionally bound to an element.
     *
     * ### Side effects
     * - When a `query` is provided, immediately resolves/binds the element via {@link setElement}.
     *
     * @param query - CSS selector or element to control. When `null`, instance starts unbound.
     */
    public constructor(query: string | HTMLElement | null = null) {
        if (query) this.setElement(query);
    }

    /**
     * Binds the effector to a target element.
     *
     * Resolution behavior:
     * - When `query` is a string, uses `document.querySelector`.
     * - When `query` is an element, uses it directly.
     *
     * Notes:
     * - If a selector does not resolve to an {@link HTMLElement}, binding is skipped and the
     *   effector remains unchanged.
     *
     * @param query - CSS selector or the HTMLElement to bind.
     */
    public setElement(query: string | HTMLElement): void {
        if (typeof query === "string") {
            const el = document.querySelector(query);
            if (el instanceof HTMLElement) this.element = el;
            return;
        }
        this.element = query;
    }

    /**
     * Cancels any pending animation/resize timers and resets the animation state.
     *
     * This is the primary "escape hatch" to stop in-flight transitions scheduled by this effector.
     *
     * ### Behavior
     * - Clears internal timeouts (`timeOut`, `resizeTimeout`) if present.
     * - Resets {@link _isAnimating} to `false`.
     *
     * @returns The current instance (chainable).
     */
    public cancel(): this {
        if (this.timeOut) {
            clearTimeout(this.timeOut);
            this.timeOut = null;
        }
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }
        this._isAnimating = false;
        return this;
    }

    /**
     * Measures dimensions of a (potentially hidden) element by temporarily applying "measuring styles".
     *
     * This helper is used to compute width/height/scrollHeight without leaving the element visible.
     *
     * ### Side effects
     * - Temporarily mutates inline styles (`display`, `visibility`, `position`, `height`, `width`).
     * - Restores the original inline styles before returning.
     *
     * No-ops:
     * - If the target {@link element} is not bound, returns `{ width: 0, height: 0, scrollHeight: 0 }`.
     *
     * @param display - The display style to use for measurement (defaults to `"flex"`).
     * @returns A dimension snapshot including `scrollHeight` adjusted for vertical borders.
     */
    public getHiddenDimensions(display: "flex" | string = "flex"): DimensionObject {
        // Guard: element may not be set yet.
        if (!this.element) return { width: 0, height: 0, scrollHeight: 0 };

        const originalStyles = {
            display: this.element.style.display,
            visibility: this.element.style.visibility,
            position: this.element.style.position,
            height: this.element.style.height,
            width: this.element.style.width,
        };

        Object.assign(this.element.style, {
            display,
            visibility: "hidden",
            position: "fixed",
            height: "fit-content",
            width: "fit-content",
        });

        const cs = window.getComputedStyle(this.element);
        const borderTopWidth = parseFloat(cs.borderTopWidth);
        const borderBottomWidth = parseFloat(cs.borderBottomWidth);

        const scrollHeight = this.element.scrollHeight + borderTopWidth + borderBottomWidth;
        const rect = this.element.getBoundingClientRect();

        const dimensions: DimensionObject = {
            width: rect.width,
            height: rect.height + borderTopWidth + borderBottomWidth,
            scrollHeight,
        };

        Object.assign(this.element.style, originalStyles);
        return dimensions;
    }

    /**
     * Runs an "expand/open" transition.
     *
     * The element is first placed into an initial collapsed state (`height: 0`, `opacity: 0`)
     * and then transitioned to its target geometry.
     *
     * ### Side effects
     * - Mutates inline styles (`display`, `width`, `left`, `top`, `maxHeight`, `height`, `opacity`, `overflow`, `transition`).
     * - Toggles position classes (`position-top` / `position-bottom`) based on config.
     *
     * ### Completion model
     * - Uses `setTimeout(duration)` to finalize (`transition: none`) and invoke `onComplete`.
     * - Does not listen for `transitionend`.
     *
     * No-ops:
     * - If {@link element} is not bound, returns immediately.
     *
     * @param config - Expand animation parameters and completion callback.
     * @returns The current instance (chainable).
     */
    public expand(config: ExpandConfig): this {
        if (!this.element) return this;

        this.cancel();
        this._isAnimating = true;

        const {
            duration = 200,
            display = "flex",
            width,
            left,
            top,
            maxHeight,
            realHeight,
            position = "bottom",
            onComplete,
        } = config;

        const initialTop = position === "bottom" ? top : top + realHeight;

        Object.assign(this.element.style, {
            display,
            width: `${width}px`,
            left: `${left}px`,
            top: `${initialTop}px`,
            maxHeight: `${maxHeight}px`,
            height: "0px",
            opacity: "0",
            overflow: "hidden",
            transition: "none",
        });

        this.element.classList.toggle("position-top", position === "top");
        this.element.classList.toggle("position-bottom", position === "bottom");

        requestAnimationFrame(() => {
            const isScrollable = realHeight >= maxHeight;

            Object.assign(this.element.style, {
                transition: `top ${duration}ms, height ${duration}ms, opacity ${duration}ms`,
                top: `${top}px`,
                height: `${realHeight}px`,
                opacity: "1",
                overflow: isScrollable ? "auto" : "hidden",
            });

            this.timeOut = setTimeout(() => {
                this.element.style.transition = "none";
                this._isAnimating = false;
                onComplete?.();
            }, duration);
        });

        return this;
    }

    /**
     * Runs a "collapse/close" transition.
     *
     * The element is transitioned to `height: 0` and `opacity: 0`, then hidden via `display: none`.
     *
     * ### Side effects
     * - Mutates inline styles (`height`, `top`, `opacity`, `overflow`, `transition`, then `display`).
     * - Reads current geometry via `offsetHeight` / `offsetTop` and scrollability via `scrollHeight`.
     *
     * ### Completion model
     * - Uses `setTimeout(duration)` to finalize and invoke `onComplete`.
     *
     * No-ops:
     * - If {@link element} is not bound, returns immediately.
     *
     * @param config - Collapse animation parameters and completion callback.
     * @returns The current instance (chainable).
     */
    public collapse(config: CollapseConfig): this {
        if (!this.element) return this;

        this.cancel();
        this._isAnimating = true;

        const { duration = 200, onComplete } = config;

        const currentHeight = this.element.offsetHeight;
        const currentTop = this.element.offsetTop;
        const position = this.element.classList.contains("position-top") ? "top" : "bottom";
        const isScrollable = this.element.scrollHeight - this.element.offsetHeight > 0;

        const finalTop = position === "top" ? currentTop + currentHeight : currentTop;

        requestAnimationFrame(() => {
            Object.assign(this.element.style, {
                transition: `height ${duration}ms, top ${duration}ms, opacity ${duration}ms`,
                height: "0px",
                top: `${finalTop}px`,
                opacity: "0",
                overflow: isScrollable ? "auto" : "hidden",
            });

            this.timeOut = setTimeout(() => {
                Object.assign(this.element.style, {
                    display: "none",
                    transition: "none",
                });

                this._isAnimating = false;
                onComplete?.();
            }, duration);
        });

        return this;
    }

    /**
     * Runs a horizontal "swipe-in" animation (reveals element by expanding width).
     *
     * The element is measured using {@link getHiddenDimensions} and then transitioned from `width: 0`
     * to the measured width.
     *
     * ### Side effects
     * - Mutates inline styles (`display`, `width`, `overflow`, `transition`).
     *
     * No-ops:
     * - If {@link element} is not bound, returns immediately.
     *
     * @param config - Swipe parameters (`duration`, `display`) and completion callback.
     * @returns The current instance (chainable).
     */
    public showSwipeWidth(config: SwipeConfig): this {
        if (!this.element) return this;

        this.cancel();
        this._isAnimating = true;

        const { duration = 200, display = "block", onComplete } = config;

        Object.assign(this.element.style, {
            transition: "none",
            display,
            width: "fit-content",
        });

        const maxWidth = this.getHiddenDimensions(display).width;

        Object.assign(this.element.style, { width: "0px" });

        requestAnimationFrame(() => {
            Object.assign(this.element.style, {
                transition: `width ${duration}ms`,
                width: `${maxWidth}px`,
                overflow: "hidden",
            });
        });

        this.timeOut = setTimeout(() => {
            Object.assign(this.element.style, {
                width: "",
                overflow: "",
                transition: "",
            });

            this._isAnimating = false;
            onComplete?.();
        }, duration);

        return this;
    }

    /**
     * Runs a horizontal "swipe-out" animation (hides element by collapsing width).
     *
     * The element is measured using {@link getHiddenDimensions} and then transitioned from
     * the measured width down to `width: 0`.
     *
     * ### Side effects
     * - Mutates inline styles (`width`, `overflow`, `transition`, and clears `display` on completion).
     *
     * No-ops:
     * - If {@link element} is not bound, returns immediately.
     *
     * @param config - Swipe parameters (`duration`) and completion callback.
     * @returns The current instance (chainable).
     */
    public hideSwipeWidth(config: SwipeConfig): this {
        if (!this.element) return this;

        this.cancel();
        this._isAnimating = true;

        const { duration = 200, onComplete } = config;

        const maxWidth = this.getHiddenDimensions().width;

        Object.assign(this.element.style, {
            transition: "none",
            width: `${maxWidth}px`,
        });

        requestAnimationFrame(() => {
            Object.assign(this.element.style, {
                transition: `width ${duration}ms`,
                width: "0px",
                overflow: "hidden",
            });
        });

        this.timeOut = setTimeout(() => {
            Object.assign(this.element.style, {
                width: "",
                overflow: "",
                transition: "",
                display: "",
            });

            this._isAnimating = false;
            onComplete?.();
        }, duration);

        return this;
    }

    /**
     * Runs a resize/reposition update for an already-visible element.
     *
     * Intended for "content changed" scenarios (e.g., list height changes, position flips).
     *
     * ### Behavior
     * - Updates size/position-related inline styles (width/left/top/maxHeight/height/overflowY).
     * - Optionally animates the transition (based on `animate` and heuristic diffs).
     * - When position flips (top ↔ bottom), a more explicit transition may be applied.
     *
     * ### Completion model
     * - Uses timeouts to clear the `transition` style and call `onComplete`.
     * - Does not listen for `transitionend`.
     *
     * No-ops:
     * - If {@link element} is not bound, returns immediately.
     *
     * @param config - Resize parameters including geometry, animation flags, and completion callback.
     * @returns The current instance (chainable).
     */
    public resize(config: ResizeConfig): this {
        if (!this.element) return this;

        this.cancel();

        const {
            duration = 200,
            width,
            left,
            top,
            maxHeight,
            realHeight,
            position = "bottom",
            animate = true,
            onComplete,
        } = config;

        const currentPosition = this.element.classList.contains("position-top") ? "top" : "bottom";
        const isPositionChanged = currentPosition !== position;
        const isScrollable = this.element.scrollHeight > maxHeight;

        this.element.classList.toggle("position-top", position === "top");
        this.element.classList.toggle("position-bottom", position === "bottom");

        if (isPositionChanged) {
            this.element.style.transition = `top ${duration}ms ease-out, height ${duration}ms ease-out, max-height ${duration}ms ease-out;`;
        }

        requestAnimationFrame(() => {
            const styles: Partial<CSSStyleDeclaration> & Record<string, string> = {
                width: `${width}px`,
                left: `${left}px`,
                top: `${top}px`,
                maxHeight: `${maxHeight}px`,
                height: `${realHeight}px`,
                overflowY: isScrollable ? "auto" : "hidden",
            };

            const heightDiff = Math.abs(this.element.offsetHeight - realHeight);

            if (animate && (isPositionChanged || heightDiff > 5)) {
                styles.transition = `height ${duration}ms, top ${duration}ms`;
            } else {
                this.resizeTimeout = setTimeout(() => {
                    if (this.element?.style) {
                        this.element.style.transition = null;
                    }
                }, duration);
            }

            Object.assign(this.element.style, styles);

            if (animate && (isPositionChanged || heightDiff > 1)) {
                this.resizeTimeout = setTimeout(() => {
                    this.element.style.transition = null;
                    if (isPositionChanged) delete this.element.style.transition;
                    onComplete?.();
                }, duration);
            } else {
                if (isPositionChanged) delete this.element.style.transition;
                onComplete?.();
            }
        });

        return this;
    }

    /**
     * Indicates whether this effector currently considers itself in an active animation window.
     *
     * Notes:
     * - This flag is time-based and is cleared when internal timeouts complete or when {@link cancel} is called.
     * - It does not guarantee that the browser is still transitioning (no `transitionend` tracking).
     *
     * @returns `true` while an animation is in-flight; otherwise `false`.
     */
    public get isAnimating(): boolean {
        return this._isAnimating;
    }
}