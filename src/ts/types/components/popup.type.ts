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

export interface PopupPosition {
    position: "top" | "bottom";
    top: number;
    maxHeight: number;
    realHeight: number;
    contentHeight: number;
}

export interface PopupLocaltion {
    width: number;
    height: number;
    top: number;
    left: number;
    padding: { top: number; right: number; bottom: number; left: number };
    border: { top: number; right: number; bottom: number; left: number };
}
