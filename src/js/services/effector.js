/**
 * @returns {EffectorInterface}
 */
export function Effector(query) {
    return new class {
        /**
         * @type {HTMLElement}
         */
        element;
        #timeOut = null;
        #resizeTimeout = null;
        #isAnimating = false;
        
        /**
         * Provides an effector utility that controls animations and resizing for a target element.
         * Supports setting the element by selector or node, canceling in-flight animations/timers,
         * and exposes methods (expand, collapse, resize) via the returned object instance.
         *
         * @param {string|HTMLElement} [query] - A CSS selector or the target element to control.
         */
        constructor(query = null) {
            if (query) {
                this.setElement(query);
            }
        }

        /**
         * Sets the target element to be controlled by the effector.
         * Accepts either a CSS selector or a direct HTMLElement reference.
         *
         * @param {string|HTMLElement} query - The element or selector to bind.
         */
        setElement(query) {
            if (typeof query === "string") {
                this.element = document.querySelector(query);
            } else {
                this.element = query;
            }
        }

        /**
         * Cancels any pending timeouts or resize triggers and resets the animation state.
         * Use this to stop ongoing expand/collapse/resize animations immediately.
         *
         * @returns {this} - The effector instance for chaining.
         */
        cancel() {
            if (this.#timeOut) {
                clearTimeout(this.#timeOut);
                this.#timeOut = null;
            }
            if (this.#resizeTimeout) {
                clearTimeout(this.#resizeTimeout);
                this.#resizeTimeout = null;
            }
            this.#isAnimating = false;
            return this;
        }

        /**
         * Get hidden dimensions
         * @param {string} display 
         * @returns {{width: number, height: number, scrollHeight: number}}
         */
        getHiddenDimensions(display = "flex") {
            const originalStyles = {
                display: this.element.style.display,
                visibility: this.element.style.visibility,
                position: this.element.style.position,
                height: this.element.style.height,
                width: this.element.style.width,
            };

            Object.assign(this.element.style, {
                display: display,
                visibility: "hidden",
                position: "fixed",
                height: "fit-content",
                width: "fit-content"
            });

            const getComputedStyle = window.getComputedStyle(this.element);
            const borderTopWidth = parseFloat(getComputedStyle.borderTopWidth);
            const borderBottomWidth = parseFloat(getComputedStyle.borderBottomWidth);

            const scrollHeight = this.element.scrollHeight + borderTopWidth + borderBottomWidth;

            const rect = this.element.getBoundingClientRect();
            
            const dimensions = {
                width: rect.width,
                height: rect.height + borderTopWidth + borderBottomWidth,
                scrollHeight: scrollHeight
            };

            Object.assign(this.element.style, originalStyles);

            return dimensions;
        }

        /**
         * Expand animation (open popup)
         * @param {Object} config
         * @param {number} config.duration - Animation duration in ms
         * @param {string} config.display - Display type
         * @param {number} config.width - Target width
         * @param {number} config.left - Left position
         * @param {number} config.top - Top position
         * @param {number} config.maxHeight - Max height
         * @param {number} config.realHeight - Real height
         * @param {string} config.position - Position type (top/bottom)
         * @param {Function} config.onComplete - Callback when complete
         * @returns {this}
         */
        expand(config) {
            this.cancel();
            this.#isAnimating = true;

            const {
                duration = 200,
                display = "flex",
                width,
                left,
                top,
                maxHeight,
                realHeight,
                position = "bottom",
                onComplete
            } = config;

            const initialTop = position === "bottom" 
                ? top 
                : top + realHeight;

            Object.assign(this.element.style, {
                display: display,
                width: `${width}px`,
                left: `${left}px`,
                top: `${initialTop}px`,
                maxHeight: `${maxHeight}px`,
                height: "0px",
                opacity: "0",
                overflow: "hidden",
                transition: "none"
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
                    overflow: isScrollable ? "auto" : "hidden"
                });

                this.#timeOut = setTimeout(() => {
                    this.element.style.transition = "none";
                    this.#isAnimating = false;
                    onComplete && onComplete();
                }, duration);
            });

            return this;
        }

        /**
         * Collapse animation (close popup)
         * @param {Object} config
         * @param {number} config.duration - Animation duration in ms
         * @param {Function} config.onComplete - Callback when complete
         * @returns {this}
         */
        collapse(config) {
            this.cancel();
            this.#isAnimating = true;

            const {
                duration = 200,
                onComplete
            } = config;

            const currentHeight = this.element.offsetHeight;
            const currentTop = this.element.offsetTop;
            const position = this.element.classList.contains("position-top") ? "top" : "bottom";
            const isScrollable = (this.element.scrollHeight - this.element.offsetHeight) > 0;

            const finalTop = position === "top" 
                ? currentTop + currentHeight
                : currentTop;

            requestAnimationFrame(() => {
                Object.assign(this.element.style, {
                    transition: `height ${duration}ms, top ${duration}ms, opacity ${duration}ms`,
                    height: "0px",
                    top: `${finalTop}px`,
                    opacity: "0",
                    overflow: isScrollable ? "auto" : "hidden"
                });

                this.#timeOut = setTimeout(() => {
                    Object.assign(this.element.style, {
                        display: "none",
                        transition: "none"
                    });
                    this.#isAnimating = false;
                    onComplete && onComplete();
                }, duration);
            });

            return this;
        }

        /**
         * show Swipe animation (close element)
         * @param {Object} config
         * @param {number} config.duration - Animation duration in ms
         * @param {String} config.display - Display for element
         * @param {Function} config.onComplete - Callback when complete
         * @returns {this}
         */
        showSwipeWidth(config) {
            this.cancel();
            this.#isAnimating = true;

            const {
                duration = 200,
                display = "block",
                onComplete
            } = config;

            Object.assign(this.element.style, {
                transition: "none",
                display: display,
                width: "fit-content"
            });

            const maxWidth = this.getHiddenDimensions(display).width;
            
            Object.assign(this.element.style, {
                width: "0px"
            });

            requestAnimationFrame(() => {
                Object.assign(this.element.style, {
                    transition: `width ${duration}ms`,
                    width: `${maxWidth}px`,
                    overflow: "hidden"
                });
            });

            this.#timeOut = setTimeout(() => {
                Object.assign(this.element.style, {
                    width: null,
                    overflow: null,
                    transition: null
                });
                this.#isAnimating = false;
                onComplete && onComplete();
            }, duration);

            return this;
        }

        /**
         * hide Swipe animation (close element)
         * @param {Object} config
         * @param {number} config.duration - Animation duration in ms
         * @param {Function} config.onComplete - Callback when complete
         * @returns {this}
         */
        hideSwipeWidth(config) {
            this.cancel();
            this.#isAnimating = true;

            const {
                duration = 200,
                onComplete
            } = config;

            const maxWidth = this.getHiddenDimensions().width;

            Object.assign(this.element.style, {
                transition: "none",
                width: `${maxWidth}px`
            });

            requestAnimationFrame(() => {
                Object.assign(this.element.style, {
                    transition: `width ${duration}ms`,
                    width: `0px`,
                    overflow: "hidden"
                });
            });

            this.#timeOut = setTimeout(() => {
                Object.assign(this.element.style, {
                    width: null,
                    overflow: null,
                    transition: null,
                    display: null
                });
                this.#isAnimating = false;
                onComplete && onComplete();
            }, duration);

            return this;
        }

        /**
         * Resize animation (when content changes)
         * @param {Object} config
         * @param {number} config.duration - Animation duration in ms
         * @param {number} config.width - Target width
         * @param {number} config.left - Left position
         * @param {number} config.top - Top position
         * @param {number} config.maxHeight - Max height
         * @param {number} config.realHeight - Real height
         * @param {string} config.position - Position type (top/bottom)
         * @param {boolean} config.animate - Whether to animate
         * @param {Function} config.onComplete - Callback when complete
         * @returns {this}
         */
        resize(config) {
            if (this.#resizeTimeout) {
                clearTimeout(this.#resizeTimeout);
            }

            const {
                duration = 200,
                width,
                left,
                top,
                maxHeight,
                realHeight,
                position = "bottom",
                animate = true,
                onComplete
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
                const curTop = this.element.offsetTop;
                const styles = {
                    width: `${width}px`,
                    left: `${left}px`,
                    top: `${top}px`,
                    maxHeight: `${maxHeight}px`,
                    height: `${realHeight}px`,
                    overflowY: isScrollable ? "auto" : "hidden"
                };

                if (animate && (isPositionChanged || Math.abs(this.element.offsetHeight - realHeight) > 5) ) {
                    styles.transition = `height ${duration}ms, top ${duration}ms`;
                } else {
                    this.#resizeTimeout = setTimeout(() => {
                        this.element.style.transition = "none";
                    }, duration);
                }

                Object.assign(this.element.style, styles);

                if (animate && (isPositionChanged || Math.abs(this.element.offsetHeight - realHeight) > 1)) {
                    this.#resizeTimeout = setTimeout(() => {
                        this.element.style.transition = "none";
                        if (isPositionChanged) {
                            delete this.element.style.transition;
                        }
                        onComplete && onComplete();
                    }, duration);
                } else {
                    if (isPositionChanged) {
                        delete this.element.style.transition;
                    }
                    onComplete && onComplete();
                }
            });

            return this;
        }

        /**
         * Check if currently animating
         * @returns {boolean}
         */
        get isAnimating() {
            return this.#isAnimating;
        }
    }(query);
}