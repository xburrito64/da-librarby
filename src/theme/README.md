# Themes

The whole look of Da Librarby comes from this folder. Each theme can be chosen in **Settings → Appearance**,
applies instantly, and is remembered in the library database.

- `base.css`: the shared layout. Everything visual in it reads a CSS variable (colours, fonts, corner
  shapes, card frames, navigation size and position, spotlight size).
- `velvet.css`, `paper.css`, `neon.css`, `mochi.css`: the themes. `snowdin/` is a theme with extras (see below).
- `themes.ts`: the list shown in Settings (name, description, light or dark), plus the font imports.
- `theme.ts`: applies and saves the current theme.

## Adding a theme

1. Copy one of the theme files, e.g. `velvet.css` → `sunset.css`, and replace `velvet` with `sunset` in it.
2. Inside `[data-theme="sunset"] { ... }` set the variables: colours, fonts, shapes. These also drive the
   small preview in Settings, so keep anything the preview needs (colours, fonts, `--radius-card`,
   `--card-frame`, `--card-clip`, `--btn-clip`, `--btn-radius`, `--app-decor`) in this block.
3. Rules that change the real screens (navigation layout, spotlight, cards, show page) go under
   `:root[data-theme="sunset"] ...`. The `:root` part keeps them from leaking into the previews of
   other themes.
4. Import the file in `themes.ts` and add an entry to `THEMES`. New fonts: `npm i @fontsource-variable/<font>`
   and import it at the top of `themes.ts`, so it works offline.

Handy layout variables: `--nav-w` (non-zero turns the top bar into a sidebar), `--nav-h`, `--hero-top`
(0 lets the spotlight slide under the navigation), `--hero-h`, `--hero-margin`, `--hero-radius`,
`--rows-overlap`, `--card-w`, `--row-card-w`, `--card-gap`, `--gutter`.

Rules for a theme's own preview card should start with `[data-theme="sunset"] > .tprev`: the `>` keeps
them to that card, instead of every preview while Sunset is the active theme.

## Extras

A theme can do more than colours, fonts and shapes. Everything below is optional and set in the theme's
`extras` (see `ThemeExtras` in `themes.ts`); Snowdin (`snowdin/`) uses all of it, so it doubles as an example.
Themes that leave it out look and behave exactly as before.

- `options`: settings of its own, listed under the theme cards in Settings → Appearance (on/off
  switches, a choice of a few values, or a colour with `kind: "color"`: presets as swatches plus any
  colour). Read them with `useThemeOption("id")`. The ids `sounds`, `volume`, `typing` and `music`
  (`"off"`, `"quiet"`, `"normal"`, `"loud"`) are understood by the app itself.
- `apply`: called with the option values while the theme is on and whenever they change, for options
  the stylesheet can't handle alone (Snowdin redraws its heart in the chosen colour and turns the heart
  pointer on or off).
- `copy`: replaces texts such as the empty-search message, the empty-library page, the scanning line and
  the search placeholder, and adds flavor: lines under the home screen (`homeEnd`, `lateNight`,
  `december`), secret search words (`searchSecrets`) and things said when the app's name is clicked
  (`brandLines`), and with `check` a "Check" button on movie pages that shows the theme's own lines
  about the movie instead of its description (Snowdin's game-style CHECK). See `copy.ts`.
- `typing`: descriptions and messages type themselves out (the `Typed` component in `src/ui`). A line
  starting with `* ` gets its `*` in a separate `.typed__mark` the theme can draw.
- `sounds`: little interface sounds (`move`, `select`, `back`, `save`, `nope`, `text`), made with
  `tone()` from `synth.ts`. They play on pointing at and picking things and never during a video.
  Elements can ask for a particular sound with `data-sfx="save"` (or `"none"`).
- `icons`: pixel versions of the app's icons, by name (see `src/ui/icons.tsx`), drawn from rows of `#`
  and `.`.
- `ownFiles`: a folder on the owner's PC (`<app data>/theme-files/<theme id>/`) where they can put their own
  font (`font.ttf`, `.otf`, `.woff2`) and sound files named after the sounds (`select.wav`, ...), used
  instead of the theme's (see `ownFiles.ts`), and with `music: true` a `music.ogg` (or `.mp3`, ...) that
  loops in the background of the library; several (`music-1.ogg`, `music-town.ogg`, ...) take turns
  (see `music.ts`). Settings shows what's in use. The files never become part
  of the app or the project.
- `brandClick`: answers clicks on the app's name with something to say (or the usual
  `brandLines`); Snowdin swings its sign and wakes the dog sleeping on it.
- `Decor`: a component drawn behind the library screens (Snowdin's falling snow), given the theme's option
  values.

Empty spots in the markup, hidden unless a theme shows them: `.hero__decor--back` / `--top` /
`--bottom` (the spotlight; "back" sits right in front of the artwork), `.tp__decor--back` / `--top` /
`--bottom` (show pages), `.tprev__decor` (the preview card), `.nav__decor` (on the app's name),
`.empty__art` and `.search__none-art` (empty pages). Descriptions sit in `.hero__desc-box` and
`.tp__desc-box`, for themes that frame them.

Movie pages carry `.tp--movie`: their artwork fills the window (or, in Paper and Mochi, a much bigger
picture), followed by `.about` (the film, your copy, your watching), `.cast` and "more like this". Themes that change
the show page's artwork usually need a `.tp--movie` version of that too.
