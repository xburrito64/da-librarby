import React from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import "./index.css";
import "./theme/themes";
import { initTheme, preloadFonts } from "./theme/theme";
import { installInterfaceSounds, installSoundFocus, warmSounds } from "./theme/sound";
import { installMusic } from "./theme/music";
import { initScale } from "./ui/scale";
import { installMeter } from "./perf/meter";
import type { StressArgs } from "./perf/stress";

initTheme();
preloadFonts();
initScale();
installInterfaceSounds();
installSoundFocus();
warmSounds();
installMusic();
installMeter();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// The window starts hidden; show it once the first frame (in the right theme) is drawn.
requestAnimationFrame(() => requestAnimationFrame(() => invoke("app_ready").catch(() => {})));

// Started for the stress test (src/perf/stress.ts).
invoke<StressArgs | null>("perf_stress_args")
  .then((args) => args && import("./perf/stress").then((m) => m.runStress(args)))
  .catch((e) => console.error("Stress test failed", e));
