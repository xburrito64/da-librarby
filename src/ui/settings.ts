// Small interface settings kept in the library database (keys must start with "ui.").
import { invoke } from "@tauri-apps/api/core";

export function getSetting<T>(key: string): Promise<T | null> {
  return invoke<string | null>("ui_setting", { key })
    .then((v) => (v == null ? null : (JSON.parse(v) as T)))
    .catch(() => null);
}

export function setSetting(key: string, value: unknown) {
  return invoke("set_ui_setting", { key, value: value == null ? null : JSON.stringify(value) }).catch(() => {});
}
