# coroners-metadata-editor

Inline metadata editor for NT Coroners Court inquest-finding documents, built on top of the **Squiz Matrix** CMS.

The editor renders as a table of inquest records inside a Matrix page. Each cell is click-to-edit; saves are written back to the CMS in real time via the Matrix JS API. `src/` is the active development layer; everything else is the pre-built CMS context that the custom code runs inside.

---

## Repository layout

```
.
├── src/
│   ├── editor.js               # Custom JS — interactions, API calls, DataTables init
│   └── eoi-metadata-editor.css # Custom CSS — edit affordances, status colours, tooltips
│
├── row-template.html           # Matrix row template (one <tr> per asset, %keyword% substitution)
├── server-functions.html       # Matrix server-side JS (runat="server", runs at page-generate time)
│
├── Document metadata editor … .html          # Static dev snapshot of the live CMS page
├── Document metadata editor … _files/        # Vendor assets saved alongside the snapshot
│   ├── bootstrap.min.css / .js
│   ├── jquery-3.3.1.min.js / jquery-ui.*
│   ├── metadata-editor-js-api  # Squiz Matrix JS API (extensionless — served by CMS)
│   ├── datatables.lib.js
│   ├── ntg-styles.css          # NT Government design-system stylesheet
│   └── …
│
├── vite.config.js              # Vite dev-server — HMR, static bypass, redirect
└── package.json
```

---

## How the CMS integration works

```
Browser
  │
  ▼
Squiz Matrix page  ←─ server-functions.html  (runat="server" JS, generates dropdowns)
  │                ←─ row-template.html       (one <tr> per listed asset, %keywords% replaced)
  │                ←─ src/editor.js           (loaded as a Custom JS asset in Matrix)
  │                ←─ src/eoi-metadata-editor.css  (loaded as a Custom CSS asset in Matrix)
  │
  ▼  (user edits a cell)
Squiz_Matrix_API.setMetadata()   →   Matrix REST endpoint   →   CMS database
```

- **`row-template.html`** is a Matrix *Design* / *Paint Layout* fragment. Squiz replaces `%asset_*%` tokens with live asset data at render time. The hidden `<td class="hidden">` with the year value is used by DataTables for chronological sorting.
- **`server-functions.html`** contains `<script runat="server">` blocks. Matrix executes these before the page is sent to the browser to generate `<select>` / multi-select widgets from the metadata field schema.
- **`src/editor.js`** runs in the browser. It initialises the `Squiz_Matrix_API`, wires up the jquery.editable click-to-edit behaviour, and calls `setMetadata` on blur/change.
- **`src/eoi-metadata-editor.css`** styles the edit-affordance tooltips (`::before` / `::after` pseudo-elements with Font Awesome icon + "Edit {label}" text), per-status row colours, and the fixed-position save-result toast.

Metadata field IDs (`data-metadataFieldID="202308"` etc.) are specific to this Matrix instance. They must not be changed without updating the corresponding fields in the CMS.

---

## Local development

### Prerequisites

- Node.js ≥ 18
- npm

### Install

```bash
npm install
```

### Run dev server

```bash
npm run dev
```

Vite starts on **http://localhost:5173** and opens the main HTML directly. The browser is redirected from `/` to the snapshot file automatically.

#### What HMR covers

| File changed | Browser behaviour |
|---|---|
| `src/eoi-metadata-editor.css` | CSS hot-replaced (no reload) |
| `src/editor.js` | Full page reload |
| `row-template.html` / `server-functions.html` | No effect — these are CMS-side; refresh snapshot to see changes |

#### Known limitations in local dev

| Feature | Status |
|---|---|
| Click-to-edit / save | **Broken** — `Squiz_Matrix_API` is only available when the page is served from Matrix |
| Dropdown / multi-select widgets | **Not rendered** — `runat="server"` blocks do not execute in a browser |
| Status background colours on table cells | Partially visible — `data-status` is present in the snapshot |
| Font Awesome edit icons | Visible only if the FA Pro webfont loads (it loads from the snapshot's CDN reference) |

Local dev is primarily useful for **CSS and layout work**. JS logic that calls the API must be tested on the live CMS dev environment.

---

## Deploying changes to the CMS

1. **`src/editor.js`** — Copy the file content into the linked Matrix JS asset (or the page's Custom JS field). The asset URL is referenced in the live page as `metadata-editor-js-api` is not this file — the editor JS is loaded separately in the page configuration inside Matrix.
2. **`src/eoi-metadata-editor.css`** — Copy the file content into the corresponding Matrix CSS asset.
3. **`row-template.html`** — Paste content into the Matrix Design asset that controls the row paint layout for this page's listing.
4. **`server-functions.html`** — Paste content into the Matrix asset (or global JS include) that runs the server-side functions.

There is no build/bundle step. Matrix serves these as-is.

---

## Refreshing the dev snapshot

The snapshot (`Document metadata editor … .html` + `_files/`) is a browser-saved copy of the live CMS page:

1. Open the live page in Chrome/Edge.
2. **File → Save as → Webpage, Complete**.
3. Replace the existing `.html` and `_files/` in the repo with the newly saved files.
4. Run the row-trimming step below to keep the dev file fast.

> **Note:** The filename contains a Unicode curly apostrophe **U+2019** (`'`), not a plain ASCII apostrophe (`'`). Tools that manipulate the filename by URL must encode it as `%E2%80%99`, not `%27`. Node.js `fs.readdirSync` and shell globs see the raw Unicode character and work normally.

### Trimming rows for dev performance

The live page can have 400+ rows. To reduce to 50 (keeping oldest + newest, random sample of the rest):

```js
// trim-rows.js — run once then delete
const fs = require('fs');
const TARGET = 50;
const SEED = 42;

const filename = fs.readdirSync(__dirname).find(f => f.endsWith('.html') && f.includes('Attorney'));
const content = fs.readFileSync(filename, 'utf8');

const tbodyStart = content.indexOf('<tbody>') + '<tbody>'.length;
const tbodyEnd = content.lastIndexOf('</tbody>');
const tbodyContent = content.substring(tbodyStart, tbodyEnd);

const rows = tbodyContent.split(/(?=[ \t]*<tr id=")/).filter(s => /<tr id="/.test(s));

function getYear(row) {
  const m = row.match(/class="hidden">\s*(\d{4})/);
  return m ? parseInt(m[1], 10) : 0;
}

let oldestIdx = 0, newestIdx = 0, minYear = Infinity, maxYear = -Infinity;
rows.forEach((row, i) => {
  const yr = getYear(row);
  if (yr < minYear) { minYear = yr; oldestIdx = i; }
  if (yr > maxYear) { maxYear = yr; newestIdx = i; }
});

const mustKeep = new Set([oldestIdx, newestIdx]);
const pool = rows.filter((_, i) => !mustKeep.has(i));

let seed = SEED;
function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; }
for (let i = pool.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [pool[i], pool[j]] = [pool[j], pool[i]];
}

const finalRows = [rows[oldestIdx], ...pool.slice(0, TARGET - 2), rows[newestIdx]];
finalRows.sort((a, b) => getYear(a) - getYear(b));

const newContent = content.substring(0, tbodyStart) + '\n' + finalRows.join('') + '\n        ' + content.substring(tbodyEnd);
fs.writeFileSync(require('path').join(__dirname, filename), newContent, 'utf8');
console.log(`Written ${finalRows.length} rows.`);
```

```bash
node trim-rows.js && rm trim-rows.js
```

---

## Vite config reference (`vite.config.js`)

The config uses a single plugin (`dev-server-setup`) with three responsibilities:

### 1 — CSS injection (`transformIndexHtml`)
Injects `<link rel="stylesheet" href="/src/eoi-metadata-editor.css">` into every served HTML page. Vite tracks this link for CSS HMR.

### 2 — Vendor static bypass (middleware)
Assets under `_files/` are piped directly to the response with the correct `Content-Type`, bypassing Vite's transform pipeline. This is necessary because:

- Minified vendor files reference missing `.map` files, which crash Vite's source-map loader.
- `ntg-styles.css` contains a malformed rule that fails PostCSS parsing.
- One asset (`css`) is **extensionless** (a saved Google Fonts response). The bypass includes a MIME sniffer that reads the first 64 bytes to identify it as CSS.

### 3 — JS change watcher
`src/**/*.js` is added to the Vite file watcher. Any save triggers `full-reload` via the Vite WebSocket. This is required because `editor.js` is embedded as an inline `<script>` in the snapshot HTML rather than being a proper ES module in Vite's module graph.

### Root redirect (middleware)
A request to `/` returns a 302 to the main HTML's URL-encoded path so that opening `http://localhost:5173` just works.

---

## Matrix metadata field IDs (quick reference)

| Field label | Field ID |
|---|---|
| Inquest.Into.The.Death.Of | 202308 |
| Inquest.Link.Text | 1588321 |
| Inquest.Link.Text.Override | 1588322 |
| Date.Inquest.Commencing | 203700 |
| Date.Of.Findings | 202321 |
| Date.Of.Findings.Text | 270998 |
| Location.Of.Inquest | 202312 |
| Inquest.Category | 1588320 |
| inquestTags | 1156510 |

Field IDs are the Matrix asset IDs of the metadata field definitions, not numeric sequences — they will differ between environments (prod vs. dev/UAT).

---

## Troubleshooting

**`npm run dev` opens the wrong URL / 404**
The filename apostrophe must be U+2019. If you re-saved the snapshot and the apostrophe changed, update `MAIN_HTML` in `vite.config.js` accordingly and re-encode it as `%E2%80%99` for U+2019 or `%27` for a plain ASCII `'`.

**PostCSS / import-analysis errors on startup**
Vendor files in `_files/` should be served by the bypass middleware before Vite's pipeline sees them. If new vendor files are added outside `_files/` (or the directory name changes after a re-save), extend the `url.includes('_files/')` check in `vite.config.js`.

**Dropdowns / multi-selects are empty in local dev**
Expected. They are generated by `runat="server"` blocks that run in Matrix, not in the browser. Only the CMS dev environment can render them.

**Port already in use**
Previous Vite processes may be holding ports. On Windows: `netstat -ano | findstr 5173` then `taskkill /PID <pid> /F`.
