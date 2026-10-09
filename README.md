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
- **Movie pages** with the artwork across the whole window, the cast, everything about the film,
  your copy of it (picture, audio and subtitle tracks) and your watching, and more like it from
  your library. Movies kept in a show's folder get a page of their own too.
- **A proper player.** Built on [mpv](https://mpv.io), so it plays practically anything without
  converting. Pictures on the seek bar show where you'll land. Chapters, audio and subtitle tracks
  (remembered per show), subtitle size and position, playback speed, skip intro/credits, frame by
  frame, screenshots, a sleep timer, and the next episode plays on its own (or a random one, when
  shuffling a show). A mini player keeps the video small and on top in a corner while you do
  other things.
- **Remembers what you watched.** Resume where you stopped, watched marks, "Continue watching" on
  the home screen, "New" badges for recently added episodes, My List for things you want to
  watch later, where you are in each show, a little celebration when you finish a season, and a
  Watch time page (how much, when and what you watch).
- **Search, filters, sorting, right-click menus,** "Surprise me", arrow-key browsing and keyboard
  shortcuts for everything. Everything grows with the window on big screens, and an interface size
  slider makes it bigger or smaller.
- **Five themes**, switchable any time in Settings → Appearance: **Velvet** (dark and cinematic),
  **Paper** (a film magazine), **Neon** (synthwave arcade), **Mochi** (soft pastel) and **Snowdin**
  (a cozy snowy pixel town, after the game this app's name comes from, with falling snow, a heart
  pointer in the colour of your choice, little sounds, a battle start when you press Play and a
  few secrets; you can give it your own font, sound files and background music).

## Getting started

1. Download `Da.Librarby_x.y.z_x64-setup.exe` from the [Releases](../../releases) page and run it.
   Windows may warn about an "unknown publisher", because the installer isn't signed (signing costs
   money). Click **More info → Run anyway**.
2. Open **Settings → Library folders** and add the folders (or whole drives) with your videos.
3. For shows and movies, add a free TMDB key in **Settings → Online info**, which explains it step
   by step: create an account on [themoviedb.org](https://www.themoviedb.org/signup), go to
   **Settings → API**, request a key (personal use), and paste the "API Read Access Token" or
   "API Key". Anime info from AniList needs no key.

That's it. Covers and info fill in over the next few minutes. When a new version comes out, a
small note in the app says so, with a download button; running the new installer keeps your
library, watch history and settings.

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

Extras are listed under headings taken from their folders: an `Extras` folder inside a season
folder goes under that season, folders inside a general `Extras` folder (`Season 01`, `TV Shorts`)
each get their own heading, and a movie's extras show on that movie's page.

Release tags like `[1080p]`, `WEB-DL` or group names are ignored. Episodes numbered from 1 to 500
across seasons, double episodes (`S01E01-E02`), episode 0 and in-between episodes (`E16.5`) are
understood too. If something still lands in the wrong place, **Fix match** on its page sets it by
hand.

## Privacy

Your library stays on your computer. The app only talks to AniList, TMDB and their image servers
(for info and pictures) and to GitHub (for the One Pace episode guide, and to see whether there's a
newer version; that can be turned off in Settings → About). There's no account, no
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
- Fonts (SIL Open Font License): Manrope, Fraunces, Inter, Chakra Petch, JetBrains Mono, Fredoka,
  Nunito and Pixelify Sans, via [Fontsource](https://fontsource.org).
- Snowdin is a fan theme inspired by Undertale (by Toby Fox). Its pixel art, sounds and wording were
  made for Da Librarby; nothing is taken from the game.
- Built with [Tauri](https://tauri.app) and [React](https://react.dev).
