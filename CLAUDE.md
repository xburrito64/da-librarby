# Working on Da Librarby

- The owner is not a programmer: explain decisions in plain language, keep technical detail out of
  replies, and solve problems independently before asking.
- After changing the app, rebuild and reinstall it: `powershell -ExecutionPolicy Bypass -File scripts/install.ps1`.
  The owner uses the installed app (Start Menu / desktop shortcut), not `tauri dev`.
- Commit at sensible milestones. Never push; the owner pushes to GitHub themselves.
- The look comes from switchable themes in `src/theme` (see its README). New interface pieces must use the
  theme variables rather than fixed colours or fonts, and be checked in every theme (Velvet, Paper, Neon,
  Mochi, Snowdin), including the small previews in Settings → Appearance.
- Test parsing changes against the real folder names (`cargo test` in `src-tauri`).
- Claude's desktop app sandboxes child processes: their writes to AppData are redirected to
  `%LOCALAPPDATA%\Packages\Claude_*\LocalCache`. So `tauri dev` runs use a private test database,
  separate from the owner's real one. `scripts/install.ps1` starts the install step through WMI
  (`Win32_Process.Create`) so it lands in the real location; launch the installed app the same way
  when checking it against the owner's real data.
