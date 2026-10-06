# Da Librarby

A personal, Netflix-style library and player for the anime, shows and movies on your own drives.
Point it at your folders and it finds everything, fetches covers, descriptions and episode
pictures, and plays it all in a built-in player that remembers where you left off.

Windows only for now.

## What it does

- **Finds your shows by itself.** Add a folder or a whole drive. Anime, cartoons, shows and movies
  are sorted automatically, including seasons, specials, movies inside show folders, extras and
  oddly numbered releases. New files are picked up when you switch to the app, and drives are
  noticed when they're plugged in or removed.
- **Covers and info.** Anime from [AniList](https://anilist.co), shows and movies from
  [TMDB](https://www.themoviedb.org): covers, banners, descriptions, episode names and pictures.
  Everything is saved on your computer, so the library works offline. Wrong match? Fix it by hand.
- **A proper player.** Built on [mpv](https://mpv.io), so it plays practically anything without
  converting. Chapters, audio and subtitle tracks (remembered per show), subtitle size and position,
  playback speed, skip intro/credits, screenshots, and the next episode plays on its own.
- **Remembers what you watched.** Resume where you stopped, watched marks, "Continue watching" on
  the home screen, and "New" badges for recently added episodes.
- **Search, sorting, right-click menus,** "Surprise me", and keyboard shortcuts for everything.
- **Four themes**, switchable any time in Settings → Appearance: **Velvet** (dark and cinematic),
  **Paper** (a film magazine), **Neon** (synthwave arcade) and **Mochi** (soft pastel).

## Getting started

1. Download `Da.Librarby_x.y.z_x64-setup.exe` from the [Releases](../../releases) page and run it.
   Windows may warn about an "unknown publisher", because the installer isn't signed (signing costs
   money). Click **More info → Run anyway**.
2. Open **Settings → Library folders** and add the folders (or whole drives) with your videos.
3. For shows and movies, add a free TMDB key in **Settings → Online info**:
   create an account on [themoviedb.org](https://www.themoviedb.org/signup), go to
   **Settings → API**, request a key (personal use), and paste the "API Key". Anime info from
   AniList needs no key.

That's it. Covers and info fill in over the next few minutes.

### How to name your folders

Most common layouts just work. Folders called `Anime`, `Cartoons`/`Shows`/`TV`/`Series` or
`Movies`/`Films` decide what kind of titles are inside them. For example:

```
Anime\
  Jujutsu Kaisen\
    Jujutsu Kaisen S01\
      Jujutsu Kaisen - S01E01 - Ryomen Sukuna.mkv
    Jujutsu Kaisen S02\ ...
    Movies\
      Jujutsu Kaisen 0 (2021).mkv
    Extras\
Cartoons\
  Gravity Falls\
    Season 1\
      Gravity Falls - S01E01 - Tourist Trapped.mkv
Movies\
  Your Name (2016)\
    Your Name (2016).mkv
```

Release tags like `[1080p]`, `WEB-DL` or group names are ignored. Episodes numbered from 1 to 500
across seasons, double episodes (`S01E01-E02`), episode 0 and in-between episodes (`E16.5`) are
understood too. If something still lands in the wrong place, **Fix match** on its page sets it by
hand.

## Privacy

Your library stays on your computer. The app only talks to AniList, TMDB and their image servers
(for info and pictures) and to GitHub (for the One Pace episode guide). There's no account, no
tracking and no telemetry. Your TMDB key is stored only on your computer.

## Building from source

You need [Rust](https://rustup.rs), [Node.js](https://nodejs.org) and the Visual Studio C++ build
tools. Then, once:

```
powershell -ExecutionPolicy Bypass -File scripts/setup-mpv.ps1
npm install
```

`setup-mpv.ps1` downloads `libmpv-2.dll` (shinchiro's Windows build of mpv, ~120 MB, not stored in
git). Build and install the app with:

```
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

For development with live reload: `npm run tauri dev`.

How it fits together: Tauri 2 (Rust) with a React/TypeScript interface. mpv draws the video straight
into the window and the interface sits on top with a transparent background
(`src-tauri/src/mpv.rs`, `src-tauri/src/player.rs`, `src/player`). The library lives in SQLite
(`src-tauri/src/library`), online info in `src-tauri/src/metadata`, and the look in `src/theme`
(see its README for making your own theme).

## Credits and licenses

Da Librarby is free software under the [GNU GPL v3](LICENSE) (or later).

- Playback by [mpv](https://mpv.io) (GPLv2+), using the Windows builds from
  [shinchiro/mpv-winbuild-cmake](https://github.com/shinchiro/mpv-winbuild-cmake). mpv's source code
  is available at [github.com/mpv-player/mpv](https://github.com/mpv-player/mpv).
- Anime info from [AniList](https://anilist.co).
- Show and movie info from [TMDB](https://www.themoviedb.org). This product uses the TMDB API but is
  not endorsed or certified by TMDB.
- One Pace episode titles and descriptions from the One Pace team's episode guide, gathered by
  [one-pace-metadata](https://github.com/ladyisatis/one-pace-metadata).
- Fonts (SIL Open Font License): Manrope, Fraunces, Inter, Chakra Petch, JetBrains Mono, Fredoka
  and Nunito, via [Fontsource](https://fontsource.org).
- Built with [Tauri](https://tauri.app) and [React](https://react.dev).
