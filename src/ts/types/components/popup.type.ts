export type ParentBinderMapLike = {
    container: {
        tags: {
            ViewPanel: HTMLElement;
        };
    };
    [key: string]: unknown;
};

export interface VirtualRecyclerOptions {
    scrollEl?: HTMLElement;
    estimateItemHeight?: number;
    overscan?: number;
    dynamicHeights?: boolean;
}