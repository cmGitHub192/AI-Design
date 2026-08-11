# Inova deck — paste-ready layouts

Copy a `<section class="slide">` into `index.html`, fill the bracketed text,
and set `data-screen-label`. Every slide already carries the Inova background
frame via `class="slide"`. Add `slide--cover` for cover/closing slides.

The classes come from `assets/template.html` — read its `<style>` once so you
know what each does. Do not invent new class names; compose these.

---

## 1 · Cover / Closing (pages 1, 11, 13)

Centered navy title + italic subtitle over the full frame.

```html
<section class="slide slide--cover" data-screen-label="01 Cover">
  <div class="slide__stage">
    <h1 class="cover-title">Título de la presentación</h1>
    <p class="cover-sub">IA agéntica nativa de Azure y Microsoft 365.</p>
  </div>
</section>
```

For a big title-only closing (page 11 "DEMO EN VIVO"), drop the `cover-sub`.

---

## 2 · Section header + lead (generic content slide)

Navy title (cleared from the top-left logo by `.slide-head`) + green kicker,
with a lead paragraph in the white center. Add the footer URL on content slides.

```html
<section class="slide" data-screen-label="06 Producto">
  <div class="slide__stage">
    <div class="slide-head">
      <h2 class="slide-title">Nombre del producto</h2>
      <p class="kicker">Un PM agéntico para cada persona</p>
    </div>
    <div class="stage-body">
      <p class="lead">Una frase que explica qué hace el producto para cada persona.</p>
    </div>
  </div>
  <div class="footer-url">www.inovacorporation.com</div>
</section>
```

---

## 3 · Two-column with center image (page 2 "El Problema")

Left text · framed image · right text.

```html
<section class="slide" data-screen-label="02 El problema">
  <div class="slide__stage">
    <div class="slide-head">
      <h2 class="slide-title">El problema</h2>
    </div>
    <div class="stage-body">
      <div class="cols cols-121">
        <div>
          <h3 class="col-title">Ganar el proyecto</h3>
          <p class="col-text">Una propuesta técnica nos tomaba 3 días.</p>
        </div>
        <div class="img-frame">
          <img src="assets/problema.jpg" alt="Equipo saturado" />
          <!-- swap src for a real project image, or leave the frame empty -->
        </div>
        <div>
          <h3 class="col-title">Entregar el proyecto</h3>
          <p class="col-text">Los compromisos se pierden, los sprints se improvisan y el líder coordina más de lo que decide.</p>
        </div>
      </div>
    </div>
  </div>
  <div class="footer-url">www.inovacorporation.com</div>
</section>
```

---

## 4 · Checklist + image (pages 5, 7 "El resultado" / "¿Qué hace tu PM?")

Navy check bullets on the left, framed photo on the right.

```html
<section class="slide" data-screen-label="05 El resultado">
  <div class="slide__stage">
    <div class="slide-head">
      <h2 class="slide-title">Nombre del producto</h2>
      <p class="kicker">El resultado</p>
    </div>
    <div class="stage-body">
      <div class="cols cols-2">
        <ul class="checklist">
          <li><span>3 días a minutos</span></li>
          <li><span>99% menos de tiempo de ciclo</span></li>
          <li><span>Inova es Customer Zero</span></li>
        </ul>
        <div class="img-frame">
          <img src="assets/resultado.jpg" alt="Equipo celebrando" />
        </div>
      </div>
    </div>
  </div>
  <div class="footer-url">www.inovacorporation.com</div>
</section>
```

---

## 5 · Three blue cards (page 9 "Frontier Capabilities")

Each card is blue with a circular image/icon overlapping the top edge.

```html
<section class="slide" data-screen-label="09 Frontier capabilities">
  <div class="slide__stage">
    <div class="slide-head">
      <h2 class="slide-title">Frontier capabilities</h2>
      <p class="kicker">Multiagente, aprendizaje y despliegue inteligente</p>
    </div>
    <div class="stage-body">
      <div class="card-grid n3">
        <article class="card">
          <span class="card__icon"><img src="assets/cap-1.jpg" alt="" /></span>
          <h3 class="card__title">Planificación multiagente</h3>
          <p class="card__text">Para planificar un sprint colaboran agentes de desglose, Scrum, tech lead y estimación.</p>
        </article>
        <article class="card">
          <span class="card__icon"><img src="assets/cap-2.jpg" alt="" /></span>
          <h3 class="card__title">Aprendizaje</h3>
          <p class="card__text">El Twin recuerda preferencias, aprende patrones de estimación y usa calendario e historial real.</p>
        </article>
        <article class="card">
          <span class="card__icon"><img src="assets/cap-3.jpg" alt="" /></span>
          <h3 class="card__title">Despliegue inteligente</h3>
          <p class="card__text">Elige el modelo adecuado del catálogo de Azure AI Foundry según tarea, costo y región.</p>
        </article>
      </div>
    </div>
  </div>
  <div class="footer-url">www.inovacorporation.com</div>
</section>
```

---

## 6 · Four blue cards with center title (page 12 "¿Por qué le importa a Microsoft?")

Same card, four across, under a centered navy title.

```html
<section class="slide" data-screen-label="12 Por qué Microsoft">
  <div class="slide__stage">
    <div class="slide-head">
      <h2 class="slide-title">¿Por qué le importa a Microsoft?</h2>
    </div>
    <div class="stage-body top" style="flex-direction:column; gap:0;">
      <p class="center-title">Cuatro razones</p>
      <div class="card-grid n4">
        <article class="card"><span class="card__icon"></span><h3 class="card__title">Genera consumo de Azure por usuario y por producto</h3></article>
        <article class="card"><span class="card__icon"></span><h3 class="card__title">Showcase real de lo que Microsoft está empujando</h3></article>
        <article class="card"><span class="card__icon"></span><h3 class="card__title">Acelera Microsoft 365 porque vuelve accionables</h3></article>
        <article class="card"><span class="card__icon"></span><h3 class="card__title">Demuestra talento ecuatoriano desde un partner</h3></article>
      </div>
    </div>
  </div>
  <div class="footer-url">www.inovacorporation.com</div>
</section>
```

---

## 7 · Two device/product cards (page 3 "La visión")

Two framed images with a blue caption bar under each.

```html
<section class="slide" data-screen-label="03 La visión">
  <div class="slide__stage">
    <div class="slide-head">
      <h2 class="slide-title">La visión</h2>
      <p class="kicker">Dos capas de "IQ" accionables</p>
    </div>
    <div class="stage-body">
      <div class="cols cols-2">
        <div>
          <div class="img-frame" style="aspect-ratio:16/10;"><img src="assets/imagen-1.png" alt="Descripción de la imagen" /></div>
          <p class="card__title" style="background:var(--brand-blue);color:#fff;border-radius:8px;padding:10px;margin:12px 0 0;">Foundry IQ accionable</p>
        </div>
        <div>
          <div class="img-frame" style="aspect-ratio:16/10;"><img src="assets/imagen-2.png" alt="Descripción de la imagen" /></div>
          <p class="card__title" style="background:var(--brand-blue);color:#fff;border-radius:8px;padding:10px;margin:12px 0 0;">Work IQ accionable</p>
        </div>
      </div>
    </div>
  </div>
  <div class="footer-url">www.inovacorporation.com</div>
</section>
```

---

## Notes

- **Kicker color**: green by default (`.kicker`); add `.blue` for the medium-blue
  variant when the slide already leans green.
- **Images**: drop real files under the project's `assets/` and point `src` at
  them. An empty `.img-frame` / `.card__icon` still looks intentional.
- **Rhythm**: open on a `slide--cover`, close on a `slide--cover`; keep each
  content slide to one idea. Match the source deck's cadence
  (problem → vision → product → result → why → close).
- **Circle/flow diagrams** (pages 4 and 10) are bespoke — build them as an
  absolutely-positioned group inside `.stage-body` when needed, reusing
  `--brand-blue` circles and `--brand-navy` connectors. Keep them optional.
