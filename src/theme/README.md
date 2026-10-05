# Themes

The whole look of Da Librarby comes from this folder. Each theme can be chosen in **Settings → Appearance**,
applies instantly, and is remembered in the library database.

- `base.css`: the shared layout. Everything visual in it reads a CSS variable (colours, fonts, corner
  shapes, card frames, navigation size and position, spotlight size).
- `velvet.css`, `paper.css`, `neon.css`, `mochi.css`: the themes.
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
