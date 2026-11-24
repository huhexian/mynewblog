# Icy

A quiet, fast Hugo theme for personal blogs, made of plain HTML, CSS and JavaScript.

English · [简体中文](https://github.com/DejavuMoe/hugo-theme-icy/blob/master/README.zh-CN.md)

![Icy screenshot](https://raw.githubusercontent.com/DejavuMoe/hugo-theme-icy/master/images/screenshot.png)

## Features

- One accent color of your choice, in light and dark schemes that follow the system.
- Made for reading: a table of contents beside long posts, footnote previews, alerts, code blocks with a copy button, diagrams.
- Images with a zoom viewer, galleries, live photos, an audio player with playlists, video, YouTube embeds that load on click.
- Password-protected posts, encrypted after the build.
- Search, yearly archives, a tag index, friends and changelog pages.
- Multilingual, with English and Simplified Chinese built in.
- SEO, RSS, Ecoku comments and Plausible analytics.
- No framework, no npm. Every page works without JavaScript and loads only what it uses.

## Quick start

You need Hugo 0.158.0 or later (the standard edition) and Git. Readers need Chrome or Edge 123, Firefox 125, Safari 17.5 or newer; older browsers still show every page, with plainer styling.

```sh
git submodule add --depth 1 https://github.com/DejavuMoe/hugo-theme-icy.git themes/hugo-theme-icy
```

The checkout includes the demo site (about 12 MB). To leave it out, install the theme as a [Hugo Module](https://icy.zsh.moe/docs/installation/#install) instead.

Then set the theme and the Markdown settings it needs in `hugo.toml`:

```toml
theme = 'hugo-theme-icy'

[markup.goldmark.parser]
  wrapStandAloneImageWithinParagraph = false
  [markup.goldmark.parser.attribute]
    block = true
```

Preview the site at <http://localhost:1313/>:

```sh
hugo server
```

## Documentation

Everything else is in the docs: **<https://icy.zsh.moe/docs/>**. The [demo site](https://icy.zsh.moe/) shows each feature in use.

## License

[MIT](https://github.com/DejavuMoe/hugo-theme-icy/blob/master/LICENSE) © 2026 Dejavu Moe. The text of the documentation and demo posts in `exampleSite/content/` is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/); the demo media keep their own licenses, listed in `exampleSite/data/credits.yaml`.

Bundled third-party components:

- Tabler Icons — MIT — [license](https://github.com/DejavuMoe/hugo-theme-icy/blob/master/assets/icons/tabler.LICENSE)
- Pele, with one Lucide icon — MIT and ISC — [license](https://github.com/DejavuMoe/hugo-theme-icy/blob/master/assets/js/vendor/pele.LICENSE)
