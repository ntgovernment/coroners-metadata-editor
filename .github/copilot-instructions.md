# Coroners Metadata Editor — Copilot Instructions

## Project overview

Inline metadata editor for NT Coroners Court inquest-finding documents, built on **Squiz Matrix** CMS. Renders as a DataTables table where each cell is click-to-edit with Save/Cancel; saves go back to the CMS via the Matrix JS API (`Squiz_Matrix_API.setMetadata()`).

### Key files

| File                    | Purpose                                                                           |
| ----------------------- | --------------------------------------------------------------------------------- |
| `src/editor.js`         | Core JS — click-to-edit, API calls, DataTables init, column filters               |
| `src/editor.css`        | All custom styling — edit affordances, status colours, filter bar                 |
| `row-template.html`     | Matrix row template (`%keyword%` tokens, one `<tr>` per asset)                    |
| `server-functions.html` | Matrix server-side JS (`runat="server"`) — generates `<select>` dropdowns         |
| `vite.config.js`        | Vite dev server — HMR for editor.css, vendor bypass for `_files/`                 |
| `Document…html`         | Static snapshot of the live CMS page (saved via Chrome "Save complete webpage")   |
| `Document…_files/`      | Vendor assets saved alongside the snapshot (gitignored)                           |
| `.prettierignore`       | Excludes `row-template.html` and `server-functions.html` from Prettier formatting |

### Development

```bash
npm run dev          # starts Vite dev server, opens the page in browser
```

Vite serves `src/editor.js` and `src/editor.css` with transforms and HMR. All other files in `_files/` and `src/` are served as raw static assets (bypassing Vite's pipeline). See `vite.config.js` for details.

### Architecture notes

- **jQuery IIFE pattern** — `editor.js` wraps all code in `(function ($) { ... })(jQuery)` to capture `$` at evaluation time, since the CMS page loads jQuery multiple times.
- **Resilient API init** — `Squiz_Matrix_API` is instantiated inside `$(document).ready` with a `typeof` guard. If the API library fails to load, the UI still renders (display overlays, dropdowns, filters all work) but saves show a "Save unavailable" error toast. This prevents a missing API library from killing the entire script and leaving raw `<select>` elements visible.
- **API key** — `apiOptions["key"] = "5070102576"` is the Coroners Court site key. Do not change without updating the CMS.
- **Metadata field IDs** — Each `data-metadataFieldID` attribute maps to a specific Squiz Matrix metadata field. These IDs are CMS-instance-specific and must not be changed without updating the CMS admin.
- **Date format** — Dates display as `DD/MM/YYYY` but are stored/submitted as `YYYY-MM-DD` (ISO). Conversion helpers: `isoToAustralian()` / `australianToIso()` in `editor.js`.
- **`_files/metadata-editor-js-api`** — The Squiz Matrix JS API library (extensionless file as served by the CMS). Provides `Squiz_Matrix_API` constructor.

---

## Critical rules

### Formatting exclusions

`row-template.html` and `server-functions.html` contain Squiz Matrix `%keyword%` tokens (e.g. `%globals_asset_assetid:1588320^as_asset:asset_data%`). These look like CSS/JS syntax and **will be broken by formatters** that add spaces around `%`, `^`, and `:` characters.

- `.prettierignore` excludes both files from Prettier.
- `.vscode/settings.json` associates both files as `plaintext` so VS Code's built-in HTML formatter doesn't touch them.
- **Never run format-on-save or auto-format on these files.** If a formatter has already mangled them, look for spaces injected into `%keyword%` tokens (e.g. `% globals_asset_assetid:1588320 ^ as_asset: asset_data %` should be `%globals_asset_assetid:1588320^as_asset:asset_data%`).

### Metadata field IDs — do not change

Field IDs are CMS-instance-specific asset IDs. Changing them breaks the mapping between the editor and the CMS database.

| Field label                | Field ID  |
| -------------------------- | --------- |
| Inquest.Into.The.Death.Of  | `202308`  |
| Inquest.Link.Text          | `1588321` |
| Inquest.Link.Text.Override | `1588322` |
| Date.Inquest.Commencing    | `203700`  |
| Date.Of.Findings           | `202321`  |
| Date.Of.Findings.Text      | `270998`  |
| Location.Of.Inquest        | `202312`  |
| Inquest.Category           | `1588320` |
| inquestTags                | `1156510` |

### DataTables column indices

Referenced throughout `editor.js` for sorting, filtering, visibility, and render functions. Must be updated if columns are added/removed/reordered.

| Index | Column        | Notes                                               |
| ----- | ------------- | --------------------------------------------------- |
| 0     | ID            | Links to CMS admin (`?a={id}/_admin`)               |
| 1     | Asset name    | Read-only                                           |
| 2     | Death of      | Editable text                                       |
| 3     | Link Text     | Editable text                                       |
| 4     | Override      | Editable text                                       |
| 5     | Inquest date  | Datepicker; custom render for DD/MM/YYYY→YYYYMMDD   |
| 6     | Issue date    | Datepicker; default sort column (desc); same render  |
| 7     | Date text     | Editable text                                       |
| 8     | Location      | Editable text; column filter dropdown               |
| 9     | Category      | Multi-select; column filter dropdown                |
| 10    | Year of issue | Hidden column; column filter dropdown               |
| 11    | Tags          | Editable text                                       |

---

## Squiz Matrix server-side patterns

### `row-template.html`

This is pasted into the Matrix Asset Listing's **Row Format**. It uses two types of server-side constructs:

1. **Keyword tokens** — `%asset_metadata_FieldName%` replaced at render time by the CMS.
2. **`<script runat="server">`** — inline server-side JavaScript executed by Matrix before sending HTML to the browser. Used for dropdown/multi-select fields that need to generate `<select>` elements from metadata field schemas.

#### Text field pattern
```html
<td>
    <div class="edit_area" data-metadataFieldID="{id}" data-label="{name}">
        %asset_metadata_FieldName%</div>
</td>
```

#### Date field pattern
```html
<td>
    <div class="edit_area" data-metadataFieldID="{id}" data-label="{name}" data-datepicker="true">
        %asset_metadata_FieldName^date_format:Y-m-d%</div>
</td>
```

#### Multi-select field pattern (Category)
```html
<td class="metadata-editor">
    <script runat="server">
        var metadatafield = %globals_asset_assetid:{fieldID}^as_asset:asset_data%;
        var currentvalue = "%asset_metadata_FieldName%";
        print(makeMultiSelect(metadatafield, currentvalue, '{label}'));
        print(`<span class="d-none">${currentvalue}</span>`);
    </script>
</td>
```

**Important:** The `var metadatafield` line sets a closure variable that `makeMultiSelect()` references internally as `metadatafield.assetid`. The `%globals_asset_assetid:{fieldID}^as_asset:asset_data%` keyword fetches the field's schema object (including `select_options`) from the CMS. An older `<print_var>` pattern does **not** work — it passes through to the browser as a literal unknown element.

### `server-functions.html`

Contains `makeDropdown()` and `makeMultiSelect()` — server-side functions that generate `<select>` HTML from metadata field schemas. Both:
- Receive the field schema object (`data`) and current value(s)
- Match current values against option keys and labels (case-insensitive)
- Return a `<select class="metadata_options">` with `data-metadataFieldID`, `data-current`, and `data-label` attributes
- `makeMultiSelect()` additionally HTML-entity-escapes labels and stores matched keys as a JSON array in `data-current`

---

## Client-side multi-select flow (editor.js)

When the CMS renders the page, category cells contain `<select multiple class="metadata_options">`. The client-side JS lifecycle:

1. **Init** — `$(".metadata_options").each()` reads `data-current` (JSON array), sets `.val()` on the `<select>`.
2. **Display overlay** — creates a `<div class="metadata_option_display">` showing selected option labels (newline-joined), hides the real `<select>`.
3. **Click to edit** — clicking the display div builds a `.multiselect-dropdown` with checkboxes for each option, plus Save/Cancel buttons.
4. **Save** — collects checked values, joins with `"; "`, calls `submit(value, assetid, fieldid)` which invokes `js_api.setMetadata()`.
5. **Cancel** — removes the dropdown, restores original display text.

If `Squiz_Matrix_API` was not available at init time, `submit()` shows a "Save unavailable" error toast instead of throwing.

---

## `editor.js` section map

The file follows this order inside the IIFE + `$(document).ready`:

| Lines (approx) | Section                     | Purpose                                                             |
| --------------- | --------------------------- | ------------------------------------------------------------------- |
| 1–3             | IIFE wrapper                | Captures `$` from `jQuery` at evaluation time                       |
| 4–14            | API init (guarded)          | Creates `Squiz_Matrix_API` if available; logs warning if not        |
| 18–22           | Default select values       | Reads `data-current`, sets `.val()` on `<select>` elements          |
| 27–35           | Helpers                     | `getOptionDisplayText()`, `isoToAustralian()`, `australianToIso()`  |
| 58–76           | Display overlays            | Creates `.metadata_option_display` divs, hides real `<select>`      |
| 79–101          | Accessibility init          | Adds `tabindex`, `role`, `aria-label` to editable cells             |
| 111–145         | Focus trap                  | `attachFocusTrap()` / `detachFocusTrap()` for keyboard nav          |
| 148–240         | Dropdown click handler      | Opens single-select (native `<select>`) or multi-select (checkboxes)|
| 243–328         | Save/Cancel handlers        | Multi-select and single-select save/cancel event delegation         |
| 331–356         | Click-outside / Enter key   | Dismisses open dropdowns; Enter opens them                          |
| 359–428         | Inline click-to-edit        | `makeEditable()` — textarea with Save/Cancel for text fields        |
| 431–532         | Datepicker                  | Bootstrap Datepicker with DD/MM/YYYY ↔ ISO conversion               |
| 535–587         | API submission              | `submit()` (guarded), `result()`, `refreshTableCell()`, toast       |
| 594–658         | DataTables init             | Paging, sorting, column renders, hidden Year column                 |
| 660–835         | Column filters              | Filter dropdowns, pills, clear button, search integration           |

---

## How to extend

### Add a new editable text column

1. In `row-template.html`: add a `<td>` with `<div class="edit_area" data-metadataFieldID="{id}" data-label="{name}">%keyword%</div>`
2. Update the column index comments in `editor.js`
3. If filtering is needed, add an entry to `filterConfigs`

### Add a new multi-select column

1. In `row-template.html`: add a `<td class="metadata-editor">` with a `<script runat="server">` block calling `makeMultiSelect()`
2. `editor.js` handles checkbox list rendering, Save, and Cancel automatically
3. **Do not format `row-template.html`** — Squiz `%keyword%` tokens will break

### Add a new column filter

Add an entry to `filterConfigs` in `editor.js`:
```js
{ label: "New Filter", colIdx: N, multiVal: false }
```
- `multiVal: true` for columns with newline-separated values (partial regex match)
- `multiVal: false` for exact match

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
<link rel="stylesheet" href="./Document metadata editor - new _ Attorney-General's Department_files/all.css">
```

Replace it with:

```html
<script src="https://kit.fontawesome.com/9bf658a5c7.js" crossorigin="anonymous"></script>
```

```bash
sed -i '/all\.css/c\<script src="https://kit.fontawesome.com/9bf658a5c7.js" crossorigin="anonymous"></script>' Document*html
```

### 4. Fix the `editor.js` and `datatables.lib.js` script tags

Chrome's "Save complete webpage" mangles git-bridge `<script>` tags — it changes `src` to `href` and drops the closing `</script>`. Fix both:

```bash
sed -i 's|<script type="text/javascript" href="https://agd.nt.gov.au[^"]*datatables\.lib\.js[^"]*">|<script type="text/javascript" src="./src/datatables.lib.js"></script>|' Document*html
sed -i 's|<script type="text/javascript" href="https://agd.nt.gov.au[^"]*editor\.js[^"]*">|<script type="text/javascript" src="./src/editor.js"></script>|' Document*html
```

### 5. Comment out Monsido/heatmaps scripts

Monsido is a third-party analytics service that requires a production domain token. It is not needed for local dev and throws `Domain token is not defined` errors.

Comment out the **heatmaps.js** script tag (usually on the same line as the jQuery script tag):

```bash
sed -i 's|<script type="text/javascript" src="\./Document metadata editor - new _ Attorney-General.s Department_files/heatmaps\.js"></script>|<!-- \0 -->|' Document*html
```

Comment out the **Monsido config block** and **monsido-script.js** — these span multiple lines (~20 lines starting with `<!-- Mondsido -->`). **Important:** The block already contains an HTML comment (`<!-- Mondsido -->`). To avoid a nested-comment parse error (Vite/parse5 rejects `<!-- ... <!-- ... --> ... -->`), first strip the inner comment markers, then wrap the entire block:

```bash
# 1. Remove the inner '<!-- Mondsido -->' comment markers (leave the text)
sed -i 's|<!-- Mondsido -->|Mondsido|' Document*html

# 2. Wrap from 'Mondsido' through the monsido-script.js </script> tag
sed -i '/Mondsido/,/monsido-script\.js.*<\/script>/{
  /Mondsido/s|.*|<!-- \0|
  /monsido-script\.js.*<\/script>/s|.*|\0 -->|
}' Document*html
```
