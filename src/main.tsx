import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import "./index.css";
import "./theme/themes";
import { initTheme } from "./theme/theme";

initTheme();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// The window starts hidden; show it once the first frame (in the right theme) is drawn.
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    const window = getCurrentWindow();
    window
      .show()
      .then(() => window.setFocus())
      .catch(() => {});
  }),
);
