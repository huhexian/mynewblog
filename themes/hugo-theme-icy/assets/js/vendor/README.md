# Vendored libraries

Published byte-for-byte (fingerprinted, never re-bundled) and loaded only when
a page needs them — see `vendor` in `layouts/_partials/assets/registry.html`
and `assets/js/modules/vendor.js`.

## Pele 1.6.0

- Upstream: https://github.com/obsidianmd/pele — documentation: https://pele.run/
- File: `pele.global.js` = `package/dist/pele.global.js` from the npm release, unmodified
- SHA-256: `b82d1bcd435302779a945e1e0f4a54ea56fb26e010ce3f2122f4216fcfc095d7`
- License: `pele.LICENSE` (MIT, with Lucide ISC), copied unchanged
- Used by: ` ```pele ` code blocks (`layouts/_markup/render-codeblock.html` →
  `assets/js/modules/pele.js`); styling only through Pele's documented
  `--pele-*` CSS variables (`assets/css/components/pele.css`).

To update: take an exact npm release, verify its package integrity, replace both
files, update the hash above, and check a page with diagrams in light and dark.
