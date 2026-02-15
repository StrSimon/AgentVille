import { useEffect } from "react";

interface KeyboardActions {
  toggleSound: () => void;
  toggleTimeline: () => void;
  toggleMode: () => void;
}

export function useKeyboard(actions: KeyboardActions): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case "m":
        case "M":
          actions.toggleSound();
          break;
        case "t":
        case "T":
          actions.toggleTimeline();
          break;
        case "d":
        case "D":
          actions.toggleMode();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions]);
}
