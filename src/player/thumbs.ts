// Pictures for the seek bar, made in the background while a video plays (see thumbnails.rs).
import { useEffect, useReducer, useRef } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface Info {
  path: string;
  dir: string;
  interval: number;
  count: number;
  ready: number[];
}

/** How often pointing along the bar may ask for a particular picture. */
const WANT_EVERY_MS = 120;

/** The pictures of the video at `path`: `at(time)` gives the nearest one made so far. */
export function useSeekPictures(path: string) {
  const info = useRef<Info | null>(null);
  const ready = useRef(new Set<number>());
  const lastWant = useRef(0);
  const [, redraw] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    info.current = null;
    ready.current = new Set();
    redraw();
    const offs = [
      listen<Info>("thumbs:info", (e) => {
        if (e.payload.path !== path) return;
        info.current = e.payload;
        ready.current = new Set(e.payload.ready);
        redraw();
      }),
      listen<{ path: string; index: number }>("thumbs:ready", (e) => {
        if (e.payload.path !== path) return;
        ready.current.add(e.payload.index);
        redraw();
      }),
    ];
    Promise.all(offs).then(() => invoke("thumbs_open", { path }).catch(() => {}));
    return () => offs.forEach((p) => p.then((off) => off()));
  }, [path]);

  // The player closed: the hidden player can let go of the file.
  useEffect(() => () => void invoke("thumbs_close").catch(() => {}), []);

  return {
    /** The picture for `time` (or the nearest one there is), as a URL the page can show. */
    at(time: number): string | null {
      const i = info.current;
      if (!i || ready.current.size === 0) return null;
      const want = Math.max(0, Math.min(i.count - 1, Math.round(time / i.interval)));
      let found = -1;
      for (let d = 0; d < i.count && found < 0; d++) {
        if (ready.current.has(want - d)) found = want - d;
        else if (ready.current.has(want + d)) found = want + d;
      }
      // Not there yet (or only far away): ask for it, now and then.
      if (Math.abs(found - want) > 1 && performance.now() - lastWant.current > WANT_EVERY_MS) {
        lastWant.current = performance.now();
        invoke("thumbs_want", { path, time }).catch(() => {});
      }
      return found < 0 ? null : convertFileSrc(`${i.dir}\\${found}.jpg`);
    },
  };
}
