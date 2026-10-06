// Right-click menus. Wrap the screen in <ContextMenuProvider>, then any element can call
// `openMenu(event, items)` from useContextMenu() in its onContextMenu handler.
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type MenuEntry = { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean } | "divider";

type Open = (event: React.MouseEvent, items: MenuEntry[]) => void;

const Context = createContext<Open>(() => {});

export function useContextMenu() {
  return useContext(Context);
}

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuEntry[] } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const open = useCallback<Open>((event, items) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, items });
  }, []);

  // Keep it inside the window.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!menu || !el) return;
    const { width, height } = el.getBoundingClientRect();
    el.style.left = `${Math.max(8, Math.min(menu.x, window.innerWidth - width - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(menu.y, window.innerHeight - height - 8))}px`;
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        close();
      }
    };
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("wheel", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("wheel", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [menu]);

  return (
    <Context.Provider value={open}>
      {children}
      {menu && (
        <div ref={ref} className="ctx-menu" role="menu" onContextMenu={(e) => e.preventDefault()}>
          {menu.items.map((item, i) =>
            item === "divider" ? (
              <div key={i} className="ctx-menu__divider" />
            ) : (
              <button
                key={i}
                role="menuitem"
                className={`ctx-menu__item ${item.danger ? "ctx-menu__item--danger" : ""}`}
                onClick={() => {
                  setMenu(null);
                  item.onSelect();
                }}
              >
                <span className="ctx-menu__icon">{item.icon}</span>
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </Context.Provider>
  );
}
