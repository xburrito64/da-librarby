# Working on Da Librarby

- The owner is not a programmer: explain decisions in plain language, keep technical detail out of
  replies, and solve problems independently before asking.
- After changing the app, rebuild and reinstall it: `powershell -ExecutionPolicy Bypass -File scripts/install.ps1`.
  The owner uses the installed app (Start Menu / desktop shortcut), not `tauri dev`.
- Commit at sensible milestones. Never push; the owner pushes to GitHub themselves.
- Keep the look plain and neutral until the design pass; don't lock in a visual style.
- Test parsing changes against the real folder names (`cargo test` in `src-tauri`).
