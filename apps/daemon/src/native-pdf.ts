// Dizenia's own HTML→PDF / HTML→PPTX renderer — fully independent of the
// Electron desktop renderer. It shells out to the browser ALREADY installed on
// the machine (Edge or Chrome) in headless mode:
//   • PDF  — the browser's built-in `--print-to-pdf` (honours @page + our
//            @media print, renders backgrounds/fonts with the real engine).
//   • PPTX — one `--screenshot` per slide (1920×1080), assembled into a 16:9
//            image-per-slide deck with pptxgenjs.
//
// Powers POST /api/projects/:id/deck-pdf and /deck-pptx: the web client gets a
// finished file back in one request — no pop-up, no print dialog, no
// /api/export/* desktop round-trip.

import { existsSync } from 'node:fs';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile, type ChildProcess } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Print stylesheet forced into the document before PDF rendering. Guarantees a
// deck paginates one 1920×1080 slide per page with backgrounds on, even if the
// deck's own @media print is missing or incomplete. The `:not(.active)` rule is
// the crux: deck frameworks hide inactive slides with
// `.slide:not(.active){display:none!important}` (specificity 0,2,0), which a
// bare `.slide{display:flex!important}` (0,1,0) cannot beat — so without a
// matching-specificity override only the active slide printed.
const DECK_PRINT_OVERRIDE = `<style data-od-native-pdf>
@media print {
  @page { size: 1920px 1080px; margin: 0; }
  html, body { width: 1920px !important; height: auto !important; overflow: visible !important; background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { display: block !important; transform: none !important; scroll-snap-type: none !important; }
  .deck-shell { position: static !important; display: block !important; inset: auto !important; }
  .deck-stage { width: 1920px !important; height: auto !important; transform: none !important; box-shadow: none !important; position: static !important; }
  .slide, section.slide, [data-screen-label], .deck-slide, .ppt-slide { display: flex !important; position: relative !important; inset: auto !important; width: 1920px !important; height: 1080px !important; min-height: 1080px !important; max-height: 1080px !important; overflow: hidden !important; page-break-after: always; break-after: page; opacity: 1 !important; visibility: visible !important; transform: none !important; animation: none !important; transition: none !important; }
  .slide:not(.active), section.slide:not(.active), [data-screen-label]:not(.active), .deck-slide:not(.active), .ppt-slide:not(.active) { display: flex !important; }
  .slide:last-child, [data-screen-label]:last-child { page-break-after: auto; break-after: auto; }
  .deck-counter, .deck-hint { display: none !important; }
}
</style>`;

// Screen stylesheet + script forced in before a per-slide SCREENSHOT: unscale
// the 1920×1080 stage, hide the chrome, and show ONLY the target slide. The
// script re-applies on an interval so it wins over the deck's own load script
// (which sets slide 0 active + fit()).
function slideShotInject(index: number): string {
  return `<style data-od-shot>
  #deck-stage { transform: none !important; left: 0 !important; top: 0 !important; width: 1920px !important; height: 1080px !important; }
  .deck-shell { position: static !important; inset: auto !important; }
  .deck-counter, .deck-hint { display: none !important; }
  body.od-shot .slide { display: none !important; }
  body.od-shot .slide.od-target { display: flex !important; }
</style>
<script>
  (function(){
    var idx = ${index};
    function apply(){ try {
      document.body.classList.add('od-shot');
      var sl = document.querySelectorAll('.slide');
      for (var k = 0; k < sl.length; k++) { sl[k].classList.toggle('od-target', k === idx); }
      var st = document.getElementById('deck-stage'); if (st) st.style.setProperty('transform','none','important');
    } catch (e) {} }
    if (document.readyState !== 'loading') apply();
    document.addEventListener('DOMContentLoaded', apply);
    window.addEventListener('load', apply);
    var n = 0, iv = setInterval(function(){ apply(); if (++n > 15) clearInterval(iv); }, 60);
  })();
</script>`;
}

/**
 * Locate a Chromium-family browser already on the machine. Honours the
 * `OD_PDF_BROWSER` env override, then probes the standard install paths per
 * platform. Returns null when none is found (callers surface a clear 501).
 */
export function findSystemBrowser(): string | null {
  const override = process.env.OD_PDF_BROWSER || process.env.OD_CHROME_BIN;
  if (override && existsSync(override)) return override;

  const candidates: string[] = [];
  if (process.platform === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const local = process.env['LOCALAPPDATA'] || '';
    candidates.push(
      `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pf86}\\Google\\Chrome\\Application\\chrome.exe`,
    );
    if (local) candidates.push(`${local}\\Google\\Chrome\\Application\\chrome.exe`);
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
  } else {
    candidates.push(
      '/usr/bin/microsoft-edge',
      '/usr/bin/microsoft-edge-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    );
  }
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

function injectBeforeHeadEnd(html: string, snippet: string): string {
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${snippet}</head>`);
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${snippet}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${snippet}</head>`);
  return snippet + html;
}

export class NoBrowserError extends Error {
  readonly code = 'NO_BROWSER';
  constructor() {
    super('no system browser (Microsoft Edge or Google Chrome) was found to render the file');
    this.name = 'NoBrowserError';
  }
}

// Wait for the browser to finish writing `outputPath`. Some Edge/Chrome builds
// hand the work to a background process and the launcher exits before the file
// is flushed, so we poll for the file to appear and stop growing instead of
// trusting the child's exit. A hard spawn error still fails fast.
function waitForBrowserOutput(child: ChildProcess, outputPath: string, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch { /* already gone */ }
      err ? reject(err) : resolve();
    };
    child.on('error', (err) => finish(err));
    const deadline = Date.now() + timeoutMs;
    let lastSize = -1;
    const tick = async () => {
      if (settled) return;
      try {
        const st = await stat(outputPath);
        if (st.size > 0 && st.size === lastSize) return finish();
        lastSize = st.size;
      } catch {
        /* not written yet */
      }
      if (Date.now() > deadline) return finish(new Error('browser render timed out'));
      setTimeout(() => { void tick(); }, 350);
    };
    void tick();
  });
}

const BASE_FLAGS = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check'];

/**
 * Render a self-contained HTML string to a PDF Buffer via the system browser.
 * For decks (`opts.deck !== false`) the pagination/`@page` override is injected
 * so every slide becomes its own 1920×1080 page.
 */
export async function renderHtmlToPdf(html: string, opts: { deck?: boolean } = {}): Promise<Buffer> {
  const browser = findSystemBrowser();
  if (!browser) throw new NoBrowserError();

  const doc = opts.deck === false ? html : injectBeforeHeadEnd(html, DECK_PRINT_OVERRIDE);
  const dir = await mkdtemp(join(tmpdir(), 'od-native-pdf-'));
  const inputPath = join(dir, 'input.html');
  const outputPath = join(dir, 'output.pdf');
  const profileDir = join(dir, 'profile');
  try {
    await writeFile(inputPath, doc, 'utf8');
    const child = execFile(
      browser,
      [
        ...BASE_FLAGS,
        `--user-data-dir=${profileDir}`,
        '--no-pdf-header-footer',
        `--print-to-pdf=${outputPath}`,
        pathToFileURL(inputPath).href,
      ],
      { timeout: 120_000, windowsHide: true },
    );
    await waitForBrowserOutput(child, outputPath, 120_000);
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export function countDeckSlides(html: string): number {
  return (html.match(/<section[^>]*class="[^"]*\bslide\b[^"]*"/gi) || []).length;
}

// Screenshot one slide (by 0-based index) to a PNG Buffer at 1920×1080.
async function screenshotSlide(
  browser: string,
  html: string,
  index: number,
  baseDir: string,
): Promise<Buffer> {
  const doc = injectBeforeHeadEnd(html, slideShotInject(index));
  const dir = await mkdtemp(join(baseDir, `slide-${index}-`));
  const inputPath = join(dir, 'input.html');
  const outputPath = join(dir, 'shot.png');
  const profileDir = join(dir, 'profile');
  try {
    await writeFile(inputPath, doc, 'utf8');
    const child = execFile(
      browser,
      [
        ...BASE_FLAGS,
        `--user-data-dir=${profileDir}`,
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--window-size=1920,1080',
        '--virtual-time-budget=2500',
        `--screenshot=${outputPath}`,
        pathToFileURL(inputPath).href,
      ],
      { timeout: 60_000, windowsHide: true },
    );
    await waitForBrowserOutput(child, outputPath, 60_000);
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Render a deck HTML string to an image-per-slide 16:9 .pptx Buffer via the
 * system browser (one screenshot per slide) + pptxgenjs. Throws NoBrowserError
 * when no browser is available, or an error with code 'NO_SLIDES' for a
 * non-deck artifact.
 */
export async function renderHtmlToPptx(html: string): Promise<Buffer> {
  const browser = findSystemBrowser();
  if (!browser) throw new NoBrowserError();

  const count = countDeckSlides(html);
  if (count === 0) {
    const err = new Error('no slides found to export as PPTX') as Error & { code?: string };
    err.code = 'NO_SLIDES';
    throw err;
  }

  const baseDir = await mkdtemp(join(tmpdir(), 'od-native-pptx-'));
  try {
    const images: Buffer[] = [];
    for (let i = 0; i < count; i++) {
      images.push(await screenshotSlide(browser, html, i, baseDir));
    }

    // pptxgenjs ships as a CJS `export =` class; its types don't expose a
    // construct signature through a dynamic import, so bridge via `any` (it is a
    // real constructor at runtime).
    const PptxGenJS: any = (await import('pptxgenjs')).default;
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: 'OD16x9', width: 13.333, height: 7.5 });
    pptx.layout = 'OD16x9';
    for (const img of images) {
      const slide = pptx.addSlide();
      slide.addImage({
        data: `data:image/png;base64,${img.toString('base64')}`,
        x: 0,
        y: 0,
        w: 13.333,
        h: 7.5,
      });
    }
    const out = await pptx.write({ outputType: 'nodebuffer' });
    return out as Buffer;
  } finally {
    await rm(baseDir, { recursive: true, force: true }).catch(() => {});
  }
}
