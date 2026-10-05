# Da Librarby

A personal, Netflix-style library and player for the anime, shows and movies on local drives.
Tauri 2 (Rust) + React/TypeScript, with mpv embedded in the window for playback.

## Running it

First time only, download the mpv library (~120 MB, not stored in git):

```
powershell -ExecutionPolicy Bypass -File scripts/setup-mpv.ps1
npm install
```

Then:

```
npm run tauri dev
```

## How playback works

mpv draws video straight into the app window; the web interface sits on top with a transparent
background and provides all controls. `src-tauri/src/mpv.rs` is a small binding to libmpv,
`src-tauri/src/player.rs` exposes it to the frontend, and `src/player/mpv.ts` is the frontend side.
