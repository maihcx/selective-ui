export {};

declare global {
    function createSelect(options?: CreateSelectOptions): HTMLSelectElement;
    function waitFor(ms?: number): Promise<void>;
    function waitForCondition(
        condition: () => boolean,
        timeout?: number
    ): Promise<void>;
}

interface CreateSelectOptions {
    id?: string;
    name?: string;
    multiple?: boolean;
    disabled?: boolean;
    dataset?: Record<string, string>;

    options?: Array<IOptions>

    groups?: Array<{
        label?: string,
        options?: Array<IOptions>
    }>
}

interface IOptions {
    value: string;
    text: string;
    selected?: boolean;
    dataset?: Record<string, string>;
}