import { describe, expect, it } from 'vitest';
import { rewriteSkillAssetUrls } from '../../src/server.js';

describe('rewriteSkillAssetUrls', () => {
  it('rewrites ./assets/<file> img sources to the daemon route', () => {
    const html = `<img src='./assets/hero.png' alt='' />`;
    expect(rewriteSkillAssetUrls(html, 'open-design-landing')).toBe(
      `<img src='/api/skills/open-design-landing/assets/hero.png' alt='' />`,
    );
  });

  it('handles double quotes and the no-leading-dot variant', () => {
    const html = `<img src="assets/cta.png"><a href="./assets/diagram.svg"></a>`;
    expect(rewriteSkillAssetUrls(html, 'foo')).toBe(
      `<img src="/api/skills/foo/assets/cta.png"><a href="/api/skills/foo/assets/diagram.svg"></a>`,
    );
  });

  it('rewrites sibling skill asset references', () => {
    const html = `<img src='../open-design-landing/assets/hero.png' /><a href="../skill-two/assets/guide.pdf"></a>`;
    expect(rewriteSkillAssetUrls(html, 'foo')).toBe(
      `<img src='/api/skills/open-design-landing/assets/hero.png' /><a href="/api/skills/skill-two/assets/guide.pdf"></a>`,
    );
  });

  it('leaves absolute and fragment URLs untouched', () => {
    const html = `<a href='https://example.com/assets/x.png'></a><a href='#assets'></a><img src='/assets/hero.png' />`;
    expect(rewriteSkillAssetUrls(html, 'foo')).toBe(html);
  });

  // The example is served at /api/skills/<id>/example, so a relative CSS url()
  // resolves against /api/skills/ and 404s. A background painted from a <style>
  // block then silently falls back to the next value in the CSS list.
  it('rewrites assets referenced from CSS url(), quoted or bare', () => {
    const html = [
      `<style>`,
      `.a { background-image: url("assets/background.png"); }`,
      `.b { background: url('./assets/tile.svg') repeat; }`,
      `.c { background-image: url(assets/plain.png); }`,
      `.d { background-image: url("../sibling-deck/assets/shared.png"); }`,
      `</style>`,
    ].join('\n');
    expect(rewriteSkillAssetUrls(html, 'inova-deck')).toBe(
      [
        `<style>`,
        `.a { background-image: url("/api/skills/inova-deck/assets/background.png"); }`,
        `.b { background: url('/api/skills/inova-deck/assets/tile.svg') repeat; }`,
        `.c { background-image: url(/api/skills/inova-deck/assets/plain.png); }`,
        `.d { background-image: url("/api/skills/sibling-deck/assets/shared.png"); }`,
        `</style>`,
      ].join('\n'),
    );
  });

  it('leaves data: and absolute url() values alone', () => {
    const html = `.x { background-image: url("data:image/svg+xml,%3Csvg%3E"), url(https://cdn.example.com/assets/a.png), url(/assets/b.png); }`;
    expect(rewriteSkillAssetUrls(html, 'foo')).toBe(html);
  });

  it('URL-encodes current and sibling skill ids in rewritten routes', () => {
    const html = `<img src='./assets/hero.png' /><img src="../foo bar/assets/hero.png" />`;
    expect(rewriteSkillAssetUrls(html, '../oops')).toBe(
      `<img src='/api/skills/..%2Foops/assets/hero.png' /><img src="/api/skills/foo%20bar/assets/hero.png" />`,
    );
  });

  it('returns non-string input unchanged', () => {
    expect(rewriteSkillAssetUrls('', 'foo')).toBe('');
  });
});
