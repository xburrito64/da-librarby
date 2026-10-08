// "Da Librarby 0.5.0 is out": a small note in the corner when GitHub has a newer version
// (src-tauri/src/update.rs). Looked for a little after starting and then twice a day, unless
// turned off in Settings → About. "Later" hides that version for good; the next one shows again.
import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { updates, type Update } from "../library/api";
import { getSetting, setSetting } from "./settings";
import { CloseIcon } from "./icons";

const FIRST_LOOK_MS = 20 * 1000;
const LOOK_EVERY_MS = 12 * 60 * 60 * 1000;

export const UPDATES_SETTING = "ui.updates";
const SKIPPED_SETTING = "ui.updateSkipped";

export default function UpdateNote() {
  const [update, setUpdate] = useState<Update | null>(null);

  useEffect(() => {
    let alive = true;
    const look = async () => {
      if ((await getSetting<boolean>(UPDATES_SETTING)) === false) return;
      const found = await updates.check().catch(() => null);
      const skipped = await getSetting<string>(SKIPPED_SETTING);
      if (alive && found && found.version !== skipped) setUpdate(found);
    };
    const first = window.setTimeout(look, FIRST_LOOK_MS);
    const every = window.setInterval(look, LOOK_EVERY_MS);
    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, []);

  if (!update) return null;
  const later = () => {
    setSetting(SKIPPED_SETTING, update.version);
    setUpdate(null);
  };
  return (
    <div className="update-note" role="status">
      <button className="icon-btn update-note__close" onClick={later} title="Not now" data-sfx="back">
        <CloseIcon />
      </button>
      <p className="update-note__title">Da Librarby {update.version} is out</p>
      <p className="update-note__text">
        Download it and run the installer: it updates the app and keeps your library, watch history and settings.
      </p>
      <div className="update-note__actions">
        <button className="btn btn--small btn--primary" onClick={() => openUrl(update.download ?? update.page)}>
          Download
        </button>
        <button className="btn btn--small" onClick={() => openUrl(update.page)}>
          What's new
        </button>
      </div>
    </div>
  );
}
