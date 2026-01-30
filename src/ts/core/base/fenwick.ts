import { Lifecycle } from "./lifecycle";

/**
 * Fenwick Tree (Binary Indexed Tree) used for fast prefix sums over item heights.
 *
 * ### Responsibility
 * - Maintain cumulative sums for a numeric array (here: per-item heights) with:
 *   - point updates in **O(log n)**
 *   - prefix/range queries in **O(log n)**
 * - Enable virtualization math (offset-by-index, index-by-offset) without scanning.
 *
 * ### Indexing contract
 * - Internally uses **1-based indexing**:
 *   - valid indices: `1..stackNum`
 *   - `bit[0]` is unused
 * - External callers must convert from 0-based item indices where needed
 *   (e.g., update at 0-based `i` → `add(i + 1, delta)`).
 *
 * ### Lifecycle
 * - Calls {@link Lifecycle.init} in {@link initialize}.
 * - Does not participate in mount/update DOM phases; acts as a pure in-memory helper.
 *
 * @extends Lifecycle
 * @internal Utility for {@link VirtualRecyclerView} height math.
 */
export class Fenwick extends Lifecycle {
    /** Internal BIT array. Index 0 is unused; valid range: [1..stackNum]. */
    private bit: number[] = [];

    /** Number of elements managed by the tree (logical size). */
    private stackNum = 0;

    /**
     * Creates a Fenwick tree and initializes it with the provided size (optional).
     *
     * @param {number} [stackNum=0] - Initial number of elements (all values start at 0).
     */
    constructor(stackNum = 0) {
        super();
        this.initialize(stackNum);
    }

    /**
     * Initializes lifecycle and resets the tree to the given size.
     *
     * Idempotency:
     * - {@link Lifecycle.init} is guarded by the base FSM (no-op after first init).
     *
     * @param {number} stackNum - Number of elements to allocate (values cleared to 0).
     * @returns {void}
     */
    public initialize(stackNum: number): void {
        this.init();
        this.reset(stackNum);
    }

    /**
     * Resets the tree to a new size and clears all values to 0.
     *
     * @param {number} stackNum - New number of elements (valid 1-based indices: 1..stackNum).
     * @returns {void}
     */
    public reset(stackNum: number): void {
        this.stackNum = stackNum;
        this.bit = new Array(stackNum + 1).fill(0);
    }

    /**
     * Adds `delta` to the element at **1-based** index `i`.
     *
     * Complexity: **O(log n)**
     *
     * @param {number} i - 1-based index of the element to update (1..stackNum).
     * @param {number} delta - Value to add (can be negative).
     * @returns {void}
     */
    public add(i: number, delta: number): void {
        for (let x = i; x <= this.stackNum; x += x & -x) this.bit[x] += delta;
    }

    /**
     * Returns the prefix sum for the range **[1..i]** (inclusive).
     *
     * Complexity: **O(log n)**
     *
     * @param {number} i - 1-based index up to which the sum is calculated.
     * @returns {number} The cumulative sum from 1 to i.
     */
    public sum(i: number): number {
        let s = 0;
        for (let x = i; x > 0; x -= x & -x) s += this.bit[x];
        return s;
    }

    /**
     * Returns the sum in the range **[l..r]** (1-based, inclusive).
     *
     * Complexity: **O(log n)**
     *
     * @param {number} l - Left index (inclusive).
     * @param {number} r - Right index (inclusive).
     * @returns {number} The sum in [l..r], or 0 if r < l.
     */
    public rangeSum(l: number, r: number): number {
        return r < l ? 0 : this.sum(r) - this.sum(l - 1);
    }

    /**
     * Builds the tree from a **0-based** array in **O(n log n)**.
     *
     * Each element `arr[i]` is added to index `i + 1` (1-based BIT index).
     *
     * @param {number[]} arr - Source values (0-based).
     * @returns {void}
     */
    public buildFrom(arr: number[]): void {
        this.reset(arr.length);
        arr.forEach((val, i) => this.add(i + 1, val));
    }

    /**
     * Finds the largest index `idx` such that `prefixSum(idx) <= target`.
     *
     * This is a classic Fenwick lower-bound over prefix sums.
     * In virtualization terms, it answers: "How many items fit in `target` pixels?"
     *
     * Complexity: **O(log n)**
     *
     * @param {number} target - Target prefix sum.
     * @returns {number} The largest 1-based index satisfying the condition (range 0..stackNum).
     * Returns 0 if the first element already exceeds `target`.
     */
    public lowerBoundPrefix(target: number): number {
        let idx = 0, bitMask = 1;
        while (bitMask << 1 <= this.stackNum) bitMask <<= 1;

        let cur = 0;
        for (let step = bitMask; step !== 0; step >>= 1) {
            const next = idx + step;
            if (next <= this.stackNum && cur + this.bit[next] <= target) {
                idx = next;
                cur += this.bit[next];
            }
        }
        return idx;
    }
}