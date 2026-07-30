---
name: inova-deck
en_name: "Inova Solutions branded corporate deck"
zh_name: "Inova Solutions 品牌企业演示文稿"
description: |
  Inova Solutions branded HTML deck: the corporate triangle-frame background on every slide, navy titles, green kickers, and blue rounded cards — the FaxiAI / FaxiHive house style. Single-file horizontal-swipe deck.
en_description: |
  Inova Solutions branded HTML deck: the corporate triangle-frame background on every slide, navy titles, green kickers, and blue rounded cards — the FaxiAI / FaxiHive house style. Single-file horizontal-swipe deck.
zh_description: |
  Inova Solutions 品牌 HTML 演示：每页都带企业三角边框背景、深蓝标题、绿色副标与蓝色圆角卡片。单文件横向滑动演示。
tags:
  - "corporate-deck"
  - "brand-deck"
  - "inova"
  - "inova-solutions"
  - "faxiai"
  - "faxihive"
  - "business-review"
  - "sales-deck"
triggers:
  - "inova"
  - "inova solutions"
  - "faxiai"
  - "faxi hive"
  - "faxihive"
  - "plantilla inova"
  - "deck inova"
  - "corporate deck"
  - "html deck"
  - "html slides"
od:
  mode: deck
  preview:
    type: html
    entry: index.html
  design_system:
    requires: false
    sections: [color, typography, layout, components]
  category: "corporate-strategy"
  scenario: "strategy"
  example_prompt: "Crea una presentación con la plantilla de marca Inova Solutions. Tema: [tu tema]. Público: [tu público]. Usa el fondo corporativo de triángulos en todas las diapositivas, títulos en azul marino, subtítulos verdes y tarjetas azules redondeadas. Antes de escribir, pregúntame solo lo esencial que falte (público, objetivo, número de diapositivas, datos que deben aparecer). Luego propón el plan de diapositivas y escríbelas."
---

# Inova Solutions Deck Skill

Produce a single-file horizontal-swipe HTML deck in the **Inova Solutions**
house style: the corporate triangle-frame background on every slide, navy
titles, green kickers, blue rounded cards, and navy check bullets — the look of
the FaxiAI / FaxiHive decks.

## Resource map

```
inova-deck/
├── SKILL.md               ← you're reading this
├── assets/
│   ├── template.html      ← seed: brand tokens + slide primitives + nav script (READ FIRST)
│   ├── background.png      ← REQUIRED brand background (triangle frame + Inova logo). Ships with the folder.
│   └── inova-logo.svg      ← OPTIONAL standalone logo (only if the background does NOT already embed it)
├── references/
│   └── layouts.md         ← paste-ready slide layouts matching the corporate deck
└── example.html           ← baked gallery sample
```

> **The brand background is an asset, not CSS.** `assets/background.png` is the
> Inova triangle frame (with the logo baked into the top-left). Every slide uses
> it as a full-bleed `background-image`. If the file is missing the slides fall
> back to plain white — still readable, but off-brand — so make sure it is
> present before shipping.

## Workflow

### Step 0 — Pre-flight

1. **Read `assets/template.html`** end-to-end (the `<style>` AND the `<script>`).
   The script solves the iframe navigation bugs — do not rewrite it.
2. **Read `references/layouts.md`** so you know the branded layouts (cover,
   section header, two-column, checklist-with-image, circle diagram, 3/4 cards,
   flow diagram, closing).
3. The brand tokens are already baked into the seed's `:root`; you normally do
   NOT need a separate DESIGN.md. Only override a token if the user explicitly
   asks for a color change.

### Step 1 — Copy the seed AND the background

Copy `assets/template.html` to the project root as `index.html`, and copy
`assets/background.png` to the project root as `background.png` (the seed
references it project-relative). If you use a standalone logo, copy that too.
Replace the page `<title>`.

### Step 2 — Plan the slides BEFORE writing HTML

Sketch the running order and which layout each slide uses, e.g.:

```
01  cover            FAXIAI + FAXIHIVE
02  two-column       El problema
03  cards-2          La visión (dos capas)
04  circle-diagram   FaxiAI · 5 agentes
05  checklist+image  El resultado
06  cards-4          Por qué le importa a Microsoft
07  closing          FaxiAI gana · FaxiHive entrega
```

Show this plan to the user before writing slide HTML — they can redirect cheaply.

### Step 3 — Paste and fill

For each planned slide, copy the matching `<section class="slide">` from
`layouts.md` into the body. Replace bracketed text with real, specific copy.
**No filler / no lorem.** Tag each slide with `data-screen-label="01 Cover"`, etc.,
in order.

### Step 4 — Self-check

- Every slide is a `<section class="slide">` and carries the background frame.
- Titles use `.slide-title` (navy), kickers use `.kicker` (green).
- Content clears the top-left logo and the corner triangles (the `.slide__stage`
  wrapper already insets for this).
- The footer URL (`.footer-url`) appears on content slides, not on cover/closing.

### Step 5 — Write the project file

Write the completed deck HTML to `index.html`, then send one short assistant
summary naming `index.html`. Do not paste the full HTML source in chat.

## Hard rules

- **Every slide keeps the Inova background** — never remove `class="slide"` or
  override its background to a flat color.
- **Navy titles, green kickers, blue cards.** One accent family per slide.
- **Content stays inside `.slide__stage`** so it never collides with the logo or
  the corner triangles.
- **Don't rewrite the nav script.** It's proven for the iframe preview.
- **No `scrollIntoView()`** — it yanks the host page.
- **`data-screen-label` on every slide.**
