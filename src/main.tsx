import React from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import "./index.css";
import "./theme/themes";
import { initTheme } from "./theme/theme";
import { installInterfaceSounds } from "./theme/sound";
import { installMusic } from "./theme/music";
import { initScale } from "./ui/scale";

initTheme();
initScale();
installInterfaceSounds();
installMusic();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// The window starts hidden; show it once the first frame (in the right theme) is drawn.
requestAnimationFrame(() => requestAnimationFrame(() => invoke("app_ready").catch(() => {})));
