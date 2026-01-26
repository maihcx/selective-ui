import type { CollapseConfig, DimensionObject, EffectorInterface, ExpandConfig, ResizeConfig, SwipeConfig } from "../types/services/effector.type";

/**
 * @returns {EffectorInterface}
 */
export function Effector(query?: string | HTMLElement | null): EffectorInterface {
    return new EffectorImpl(query ?? null);
}

class EffectorImpl implements EffectorInterface {
    public element!: HTMLElement;

    private timeOut: ReturnType<typeof setTimeout> | null = null;
    private resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    private _isAnimating = false;

    /**
     * Provides an effector utility that controls animations and resizing for a target element.
     * Supports setting the element by selector or node, canceling in-flight animations/timers,
     * and exposes methods (expand, collapse, resize) via the returned object instance.
     *
     * @param {string|HTMLElement|null} [query] - A CSS selector or the target element to control.
     */
    public constructor(query: string | HTMLElement | null = null) {
        if (query) this.setElement(query);
    }

    /**
     * Sets the target element to be controlled by the effector.
     * Accepts either a CSS selector or a direct HTMLElement reference.
     *
     * @param {string|HTMLElement} query - The element or selector to bind.
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
     * Cancels any pending timeouts or resize triggers and resets the animation state.
     * Use this to stop ongoing expand/collapse/resize animations immediately.
     *
     * @returns {this} - The effector instance for chaining.
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
     * Get hidden dimensions
     * @param {string} display
     * @returns {{width: number, height: number, scrollHeight: number}}
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
     * Expand animation (open popup)
     * @param {Object} config
     * @returns {this}
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
     * Collapse animation (close popup)
     * @param {Object} config
     * @returns {this}
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
     * show Swipe animation (close element)
     * @param {Object} config
     * @returns {this}
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
     * hide Swipe animation (close element)
     * @param {Object} config
     * @returns {this}
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
     * Resize animation (when content changes)
     * @param {Object} config
     * @returns {this}
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
     * Check if currently animating
     * @returns {boolean}
     */
    public get isAnimating(): boolean {
        return this._isAnimating;
    }
}