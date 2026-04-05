// ═══════════════════════════════════════════════════════════════════
// LB Phone Global Types
// Adapted from lb-phone-app-template/lb-reactts/ui/src/components.d.ts
// ═══════════════════════════════════════════════════════════════════

interface Settings {
    display: {
        theme: 'dark' | 'light';
        brightness: number;
        size: number;
    };
    locale: string;
    name: string;
    avatar?: string;
    [key: string]: unknown;
}

interface PopUpButton {
    title: string;
    cb?: () => void;
    disabled?: boolean;
    bold?: boolean;
    color?: 'red' | 'blue';
}

interface PopUp {
    title: string;
    description?: string;
    vertical?: boolean;
    buttons: PopUpButton[];
}

interface Contextmenu {
    title?: string;
    buttons: {
        title: string;
        color?: 'red' | 'blue';
        disabled?: boolean;
        cb?: () => void;
    }[];
}

declare global {
    var components: {
        setPopUp: (data: PopUp) => void;
        setContextMenu: (data: Contextmenu) => void;
        setFullscreenImage: (data: string) => void;
        setHomeIndicatorVisible: (visible: boolean) => void;
        [key: string]: unknown;
    };

    var fetchNui: <T = unknown>(eventName: string, data?: unknown, mockData?: T) => Promise<T>;
    var onNuiEvent: <T = unknown>(eventName: string, cb: (data: T) => void) => void;
    var onSettingsChange: (cb: (settings: Settings) => void) => void;
    var sendNotification: (data: { title: string; content?: string; thumbnail?: string }) => void;
    var settings: Settings;
    var appName: string;
    var resourceName: string;
}

export {};
