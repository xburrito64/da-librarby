// Frontend side of the embedded mpv player (see src-tauri/src/player.rs).
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type MpvEvent =
  | { event: "start-file" | "file-loaded" | "seek" | "playback-restart" | "shutdown" }
  | { event: "end-file"; reason: string; error: string | null };

export const mpv = {
  /** Starts mpv inside the window (no-op if already running) and observes properties. */
  init: (observe: string[]) => invoke<void>("player_init", { observe }),

  command: (...args: (string | number)[]) =>
    invoke<void>("player_command", { args: args.map(String) }),

  setProperty: (name: string, value: string | number | boolean) =>
    invoke<void>("player_set_property", { name, value }),

  getProperty: <T>(name: string) => invoke<T>("player_get_property", { name }),

  onProperty: (callback: (name: string, value: unknown) => void): Promise<UnlistenFn> =>
    listen<{ name: string; value: unknown }>("mpv:property", (e) =>
      callback(e.payload.name, e.payload.value),
    ),

  onEvent: (callback: (event: MpvEvent) => void): Promise<UnlistenFn> =>
    listen<MpvEvent>("mpv:event", (e) => callback(e.payload)),
};
