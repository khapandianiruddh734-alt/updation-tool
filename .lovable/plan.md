## Menu Price Comparator Pro — Hybrid Plan

Two deliverables in one project:

1. **React web app (this Lovable project)** — handles `.txt`, `.xlsx/.xls`, `.csv` source menus + Swiggy/Zomato CSV target. Full UI, runs in browser, no server cost, multi-user safe by design (everything is per-browser-tab, no shared state).
2. **Downloadable Python script** — bundled in `/public/downloads/` with a download button in the app. Adds OCR (images/PDF) + advanced Excel styling for users who need those formats. Runs locally with `python compare.py`.

---

### Part 1 — React App (in Lovable)

**Stack:** TanStack Start + Tailwind + shadcn. All processing client-side (no backend needed → no concurrency limits, no session cleanup, no file size quotas beyond browser memory).

**Routes**
- `/` — Landing + workflow (single page with stepper tabs)
- `/help` — Format guide, variation rules, download Python script

**Tabs (shadcn Tabs component)**
1. **Upload** — two dropzones (source menu, target CSV). File validation, size, row/sheet counts. Per-tab session ID shown in sidebar.
2. **Preview** — extracted source items table + target CSV preview with auto-detected columns (Item Name, Variation, Price, Item Type, Goods/Services).
3. **Compare** — full diff table: Item | Variation | Old ₹ | New ₹ | Status | Remarks. Search/filter, color-coded rows (yellow=updated, green=matched-unchanged, red=no-match). Match-rate stats card.
4. **Download** — updated `.xlsx` (with yellow fills, frozen header, auto-width, filter, "Update Remarks" column inserted right after "Goods/Services"), comparison report `.csv`, and a button to download the Python script for OCR/PDF support.

**Sidebar**
- Session ID (uuid, browser-local), match threshold slider (default 75), variation pricing rules (editable: Half %, Small %, 6pcs % etc.), live stats (files / items / updated / match rate).

**Libraries to add**
- `xlsx` — read .xls/.xlsx source + write styled .xlsx output
- `papaparse` — CSV parsing with delimiter + encoding auto-detect
- `fuse.js` — fuzzy matching (replaces SequenceMatcher)
- `react-dropzone` — drag-drop uploads
- `mammoth` (optional) — `.docx` text extraction in browser

**Core logic modules (client-side)**
- `lib/extract.ts` — extract `{name, price}[]` from txt/xlsx/csv/docx using the regex patterns from spec
- `lib/normalize.ts` — typo dictionary, exclude words, normalize() per spec
- `lib/match.ts` — Fuse-based fuzzy match with threshold
- `lib/variations.ts` — parent/child detection (`isParentRow`, `isVariationRow`), variation pricing rules table, parent lookup (previous non-variation row sharing item id/name)
- `lib/excel.ts` — write .xlsx preserving exact column order, insert single "Update Remarks" column after "Goods/Services", apply yellow/green/red fills, freeze row 1, auto-width, autofilter, 80% zoom

**File preservation rules** enforced in `excel.ts`: column order locked from input header, only `Price` cell values change for variation rows, only one new column added.

**Multi-user:** since everything is in-browser, each tab is fully isolated. No server, no quotas, no cleanup needed. 15+ concurrent users → trivial.

---

### Part 2 — Python Script (downloadable artifact)

Single-file `compare.py` + `requirements.txt` + short `README.md`, served from `/public/downloads/menu-comparator-python.zip`. Generated once at build time and committed.

Includes:
- pytesseract + easyocr fallback for images
- pdfplumber + PyPDF2 fallback for PDFs
- mammoth/python-docx for Word
- openpyxl for the same styled output as the React app
- Same regex patterns, normalize/typo dict, variation rules → consistent output across both
- CLI: `python compare.py --source menu.pdf --target swiggy.csv --out updated.xlsx`

The user runs it locally; we don't host Python (Lovable runtime can't run pytesseract). The download button on the app's Download tab + Help page links to the zip.

---

### What you skip vs the original spec

- No Streamlit (not supported here — React replaces the UI).
- No server-side session manager / 30-min cleanup / temp dirs — not needed in browser-only model.
- No image/PDF OCR in the web app — handled by the downloadable Python script instead (per your answer).

### Files to create

```
src/routes/index.tsx              (replace placeholder, stepper UI)
src/routes/help.tsx
src/components/UploadStep.tsx
src/components/PreviewStep.tsx
src/components/CompareStep.tsx
src/components/DownloadStep.tsx
src/components/AppSidebar.tsx
src/lib/extract.ts
src/lib/normalize.ts
src/lib/match.ts
src/lib/variations.ts
src/lib/excel.ts
src/lib/types.ts
src/store/session.ts              (zustand or React context for cross-tab state)
public/downloads/menu-comparator-python.zip
public/downloads/README.md
```

### Out of scope (ask separately if needed)
- Auth / user accounts / shared session links
- Server-side history of last 5 files (would need Lovable Cloud — say the word and I'll add it)
- Hindi / multi-language OCR (lives only in Python script)
