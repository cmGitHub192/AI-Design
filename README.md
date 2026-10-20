<h1 align="center">Disen<span>ia</span></h1>

<p align="center"><b>Estudio de diseño local que genera artefactos reales con agentes de código.</b></p>

<p align="center">
  Decks · prototipos web/móvil · dashboards en vivo · imágenes · video — ya con la marca de tu equipo,
  exportables a HTML / PDF / PPTX / MP4, corriendo en tu propia máquina.
</p>

---

## Qué es Disenia

🎨 **Un estudio de diseño local-first.** Describes un brief, eliges una plantilla y un design system, y un agente de código escribe el artefacto real (HTML/CSS de verdad, tipografías y componentes reales) que puedes previsualizar al instante y descargar.

Genera **prototipos web · escritorio · móvil**, **dashboards / artefactos en vivo**, **presentaciones (decks)**, **imágenes** y **video**, todo moldeado por el `DESIGN.md` de tu marca.

- 🖥️ **Local-first.** Todo corre donde viven tus datos: tu laptop.
- 🤖 **Agnóstico de modelo (BYOK).** Conecta tu propio endpoint — **Azure OpenAI**, OpenAI, Anthropic, Google Gemini, Ollama o cualquier endpoint compatible con OpenAI. La clave y el endpoint vienen de la configuración de la app; no se hardcodean.
- 🧩 **Componible en cuatro planos.** **Plugins** (flujos ejecutables) · **skills** funcionales (comportamiento del agente) · **design templates** (planos de render) · **design systems** (la marca).
- 🔒 **Sandbox.** El preview corre en un iframe aislado; el proxy BYOK está protegido contra SSRF en el borde del daemon.

---

## Mis plantillas

En **Inicio → Mis plantillas** tienes tus plantillas de marca listas para usar con un clic. Al pulsar **"Usar plantilla"** se crea un proyecto ya enlazado a esa plantilla (sin tener que pedírselo al agente en el prompt), con el prompt de ejemplo precargado y los assets de marca (por ejemplo el fondo corporativo) copiados al proyecto.

Ejemplo incluido: **Inova Solutions** — deck de marca con el fondo de triángulos corporativo en cada diapositiva, títulos en azul marino, subtítulos verdes y tarjetas azules redondeadas. La plantilla vive en [`design-templates/inova-deck/`](design-templates/inova-deck/).

---

## Tipos de artefacto

Dentro de un proyecto, el mismo design system produce varios tipos de salida:

| Tipo | Qué produce |
|---|---|
| **Prototipo** | Artefactos HTML de una sola página que leen tu design system y renderizan en un iframe aislado. |
| **Deck** | Presentaciones que navegas con el teclado y exportas a **PDF / PPTX**. |
| **Dashboard / artefacto en vivo** | KPI walls y paneles editables en el sitio mediante un panel de tweaks. |
| **Imagen** | Imágenes de marca con generación en alta resolución y descarga. |
| **Video (HyperFrames)** | Motion graphics HTML → MP4. |

### Exportar ("Descargar")

Cada deck exporta a **HTML** (un solo archivo, con los assets incrustados), **PDF** y **PPTX** — la exportación corre **dentro de la app** (el daemon renderiza el HTML con el navegador del sistema), así que no depende de flujos externos y las imágenes de las diapositivas se incrustan en el archivo descargado.

---

## Empezar

Requisitos: Node `~24`, pnpm `10.33.x`.

```bash
git clone <tu-repo>
cd AI-Design
corepack enable && pnpm install   # en Windows nativo: npm install -g pnpm@10.33.2
pnpm tools-dev run web
```

Abre la URL que imprime `tools-dev` (los puertos se asignan dinámicamente salvo que pases flags explícitos):

```bash
pnpm tools-dev run web --daemon-port 17456 --web-port 17573
```

En Windows nativo, `better-sqlite3` se compila desde fuente vía node-gyp (~2 min) y requiere Visual Studio Build Tools 2022+. Guía completa de entorno, variables y build empaquetado → [`QUICKSTART.md`](QUICKSTART.md); Windows → [`docs/windows-troubleshooting.md`](docs/windows-troubleshooting.md); WSL2 → [`docs/wsl-setup.md`](docs/wsl-setup.md).

### Un flujo completo — del brief al artefacto

`brief → plantilla → dirección → design system → artefacto → handoff`

1. **Escribes un brief** y eliges una plantilla (o una de **Mis plantillas**) y un design system.
2. **El agente crea el primer entregable.** Plantilla + skill + `DESIGN.md` quedan enlazados; se escriben los archivos del proyecto y el preview los sigue.
3. **Handoff a ingeniería.** El artefacto es HTML/CSS real — llévalo a Cursor, Codex o Claude Code para seguir en código. O exporta PPTX / PDF / MP4.

---

## Skills y design templates

Las **skills funcionales** viven en [`skills/`](skills/); cada una sigue la convención [`SKILL.md`][skill] y aporta comportamiento, referencias o utilidades reutilizables del agente. Los **starters renderizables** viven aparte en [`design-templates/`](design-templates/).

Dos **modos** anclan el catálogo de plantillas: `prototype` (artefactos de una página web/móvil/escritorio) y `deck` (presentaciones horizontales). Otras plantillas cubren `image`, `video`, `audio` y utilidades. El campo **`scenario`** agrupa por audiencia (`design`, `marketing`, `operation`, `engineering`, `product`, `finance`, `hr`, `sale`, `personal`).

Protocolo y estructura → [`docs/skills-protocol.md`](docs/skills-protocol.md). Endpoints: `GET /api/skills` (skills funcionales) y `GET /api/design-templates` (plantillas de render).

---

## Design Systems

Los paquetes de **design system centrados en `DESIGN.md`** viven en [`design-systems/`](design-systems/). Cada paquete puede llevar solo ese contrato Markdown, o añadir `manifest.json`, `tokens.css`, fixtures de componentes, assets y evidencia de procedencia. Cambias de sistema → el siguiente render usa los nuevos tokens.

Añade tu propia marca → suelta un `DESIGN.md` en `design-systems/<marca>/`. Guía → [`design-systems/README.md`](design-systems/README.md).

---

## Arquitectura

```
┌────────── navegador (Next.js) / shell Electron ──────────┐
│  chat · workspace de archivos · preview en iframe · ajustes │
└──────────────┬───────────────────────────┬───────────────┘
               │ /api/*                     │
               ▼                            ▼
   ┌─────────────────────────────┐   /api/proxy/{provider}/stream (SSE)
   │  daemon local (Express +     │   ─→ BYOK compatible con OpenAI
   │  SQLite)                     │       (Azure, OpenAI, Anthropic…),
   │  /api/skills · /api/design-  │       protegido contra SSRF
   │  templates · /api/plugins    │
   │  /api/design-systems         │
   │  /api/chat (SSE) · /api/proxy │
   │  /api/projects/:id/files/...  │
   └─────────┬───────────────────┘
             │ spawn(cli, [...], { cwd: proyecto })
             ▼
   ┌──────────────────────────────────────────────────┐
   │  El agente compone skill/plantilla + DESIGN.md     │
   │  y escribe los archivos del proyecto.              │
   └──────────────────────────────────────────────────┘
```

| Capa | Stack |
|---|---|
| Frontend | Next.js App Router + React + TypeScript |
| Daemon | Node 24 · Express · streaming SSE · `better-sqlite3` |
| Preview | Los runs con filesystem renderizan los archivos del proyecto; los runs BYOK sin herramientas de archivo parsean un bloque `<artifact>` en un iframe `srcdoc` aislado |
| Export | HTML (incrustado) · PDF · PPTX · ZIP · Markdown · MP4 |
| Ciclo de vida | Un solo punto de entrada: `pnpm tools-dev` (start / stop / run / status / logs / inspect / check) |

Arquitectura completa → [`docs/architecture.md`](docs/architecture.md).

---

## Comandos útiles

```bash
pnpm install
pnpm tools-dev run web --daemon-port 17456 --web-port 17573
pnpm tools-dev status --json
pnpm tools-dev logs --json
pnpm tools-dev stop

pnpm guard
pnpm typecheck
pnpm --filter @open-design/web typecheck
pnpm --filter @open-design/daemon test
```

---

## Licencia

Apache-2.0. Disenia es un proyecto derivado del estudio de diseño open-source **Open Design** (nexu-io, Apache-2.0); las skills y plantillas incluidas con su propio `LICENSE` conservan esas licencias.

[skill]: https://docs.anthropic.com/en/docs/claude-code/skills
