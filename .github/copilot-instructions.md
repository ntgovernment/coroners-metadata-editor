# Coroners Metadata Editor — Copilot Instructions

## Project overview

Inline metadata editor for NT Coroners Court inquest-finding documents, built on **Squiz Matrix** CMS. Renders as a DataTables table where each cell is click-to-edit with Save/Cancel; saves go back to the CMS via the Matrix JS API (`Squiz_Matrix_API.setMetadata()`).

### Key files

| File | Purpose |
|------|---------|
| `src/editor.js` | Core JS — click-to-edit, API calls, DataTables init, column filters |
| `src/editor.css` | All custom styling — edit affordances, status colours, filter bar |
| `row-template.html` | Matrix row template (`%keyword%` tokens, one `<tr>` per asset) |
| `server-functions.html` | Matrix server-side JS (`runat="server"`) — generates `<select>` dropdowns |
| `vite.config.js` | Vite dev server — HMR for editor.css, vendor bypass for `_files/` |
| `Document…html` | Static snapshot of the live CMS page (saved via Chrome "Save complete webpage") |
| `Document…_files/` | Vendor assets saved alongside the snapshot (gitignored) |

### Development

```bash
npm run dev          # starts Vite dev server, opens the page in browser
```

Vite serves `src/editor.js` and `src/editor.css` with transforms and HMR. All other files in `_files/` and `src/` are served as raw static assets (bypassing Vite's pipeline). See `vite.config.js` for details.

### Architecture notes

- **jQuery IIFE pattern** — `editor.js` wraps all code in `(function ($) { ... })(jQuery)` to capture `$` at evaluation time, since the CMS page loads jQuery multiple times.
- **API key** — `apiOptions["key"] = "5070102576"` is the Coroners Court site key. Do not change without updating the CMS.
- **Metadata field IDs** — Each `data-metadataFieldID` attribute maps to a specific Squiz Matrix metadata field. These IDs are CMS-instance-specific and must not be changed without updating the CMS admin.
- **Date format** — Dates display as `DD/MM/YYYY` but are stored/submitted as `YYYY-MM-DD` (ISO). Conversion helpers: `isoToAustralian()` / `australianToIso()` in `editor.js`.
- **`_files/metadata-editor-js-api`** — The Squiz Matrix JS API library (extensionless file as served by the CMS). Provides `Squiz_Matrix_API` constructor.

---

## After refreshing the HTML from PROD

When the main HTML file (`Document metadata editor - new _ Attorney-General's Department.html`) is updated with a fresh copy from PROD, perform the following steps:

### 1. Rename `.download` files

Chrome saves JS files with a `.download` suffix when saving a complete web page. Remove the `.download` extension from all files in the `_files/` directory, overwriting the old versions:

```bash
cd c:/Projects/coroners-metadata-editor
for f in Document*files/*.download; do
  base="${f%.download}"
  mv "$f" "$base"
done
```

### 2. Update `.download` references in the HTML

Remove all `.js.download` references in the HTML file so they point to `.js`:

```bash
sed -i 's/\.js\.download/.js/g' Document*html
```

Verify no `.download` references remain:

```bash
grep '\.download' Document*html
```

### 3. Replace FontAwesome with dev kit

PROD uses a local `all.css` for FontAwesome icons. For local dev, replace it with the FontAwesome kit script.

Find the line:

```html
<link
  rel="stylesheet"
  href="./Document metadata editor - new _ Attorney-General's Department_files/all.css"
/>
```

Replace it with:

```html
<script
  src="https://kit.fontawesome.com/9bf658a5c7.js"
  crossorigin="anonymous"
></script>
```

```bash
sed -i '/all\.css/c\<script src="https://kit.fontawesome.com/9bf658a5c7.js" crossorigin="anonymous"></script>' Document*html
```

### 4. Fix the `editor.js` script tag

Chrome's "Save complete webpage" mangles the `editor.js` `<script>` tag — it changes `src` to `href` and drops the closing `</script>`. The browser then treats subsequent HTML as inline JavaScript, causing `Unexpected token '<'` errors.

Find a line like:

```html
<script type="text/javascript" href="https://agd.nt.gov.au/__data/assets/git_bridge/0005/1603751/src/editor.js?h=...">
```

Replace it with:

```html
<script type="text/javascript" src="./src/editor.js"></script>
```

```bash
sed -i 's|<script type="text/javascript" href="https://agd.nt.gov.au[^"]*editor\.js[^"]*">|<script type="text/javascript" src="./src/editor.js"></script>|' Document*html
```

### 5. Comment out Monsido/heatmaps scripts

Monsido is a third-party analytics service that requires a production domain token. It is not needed for local dev and throws `Domain token is not defined` errors.

Comment out the **heatmaps.js** script tag (usually on the same line as the jQuery script tag):

```bash
sed -i 's|<script type="text/javascript" src="\./Document metadata editor - new _ Attorney-General.s Department_files/heatmaps\.js"></script>|<!-- \0 -->|' Document*html
```

Comment out the **Monsido config block** and **monsido-script.js** — these span multiple lines (~20 lines starting with `<!-- Mondsido -->`). Wrap the `<script>` block containing `window._monsido` and the `monsido-script.js` `<script>` tag in HTML comments (`<!-- ... -->`).
