import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_PRODUCTION_DOMAIN,
  resolveProductionBaseUrl,
  resolveSeoMetadata,
  safeSerializeJsonLd,
} from '../src/seo/seoConfig';
import {
  generateRobotsTxt,
  generateSitemapXml,
  injectSeoIntoHtml,
  renderNotFoundHtml,
} from '../src/seo/serverSeo';

describe('Technical SEO, Google Search & Search Console Validation Suite', () => {
  it('resolves the verified production HTTPS domain and rejects localhost or preview URLs', () => {
    assert.equal(resolveProductionBaseUrl(undefined), DEFAULT_PRODUCTION_DOMAIN);
    assert.equal(resolveProductionBaseUrl('http://localhost:3000'), DEFAULT_PRODUCTION_DOMAIN);
    assert.equal(
      resolveProductionBaseUrl('https://your-app-domain.example.com'),
      DEFAULT_PRODUCTION_DOMAIN
    );
    assert.equal(
      resolveProductionBaseUrl(
        'https://ais-dev-bgamhslwxhdchajztdwl3k-329218982070.asia-southeast1.run.app'
      ),
      DEFAULT_PRODUCTION_DOMAIN
    );
  });

  it('generates a valid robots.txt with public allowances, private disallowances, and production Sitemap URL', () => {
    const robots = generateRobotsTxt();
    assert.match(robots, /User-agent: \*/);
    assert.match(robots, /Allow: \/\n/);
    assert.match(robots, /Disallow: \/api\//);
    assert.match(robots, /Disallow: \/owner/);
    assert.match(robots, /Disallow: \/\*\?q=\*/);
    assert.match(robots, new RegExp(`Sitemap: ${DEFAULT_PRODUCTION_DOMAIN}/sitemap\\.xml`));
  });

  it('generates a valid XML sitemap with canonical HTTPS URLs and without arbitrary priority/changefreq', async () => {
    const xml = await generateSitemapXml(DEFAULT_PRODUCTION_DOMAIN);
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
    assert.match(xml, new RegExp(`<loc>${DEFAULT_PRODUCTION_DOMAIN}/</loc>`));
    assert.match(xml, new RegExp(`<loc>${DEFAULT_PRODUCTION_DOMAIN}/\\?app=xonddit</loc>`));
    assert.match(xml, new RegExp(`<loc>${DEFAULT_PRODUCTION_DOMAIN}/about</loc>`));
    // Must not include duplicate /?app=xongle
    assert.doesNotMatch(xml, /\?app=xongle</);
    // Must not include deprecated priority or changefreq
    assert.doesNotMatch(xml, /<priority>/);
    assert.doesNotMatch(xml, /<changefreq>/);
  });

  it('generates unique titles, meta descriptions, self-referencing canonicals, and valid JSON-LD across routes', () => {
    const xongleMeta = resolveSeoMetadata({ app: 'xongle', lang: 'en' });
    const xondditMeta = resolveSeoMetadata({ app: 'xonddit', lang: 'en' });
    const aboutMeta = resolveSeoMetadata({ app: 'about', lang: 'en' });
    const commMeta = resolveSeoMetadata({
      app: 'xonddit',
      communitySlug: 'technology',
      communityName: 'Technology & Engineering',
    });

    // Unique titles and descriptions
    const titles = new Set([
      xongleMeta.title,
      xondditMeta.title,
      aboutMeta.title,
      commMeta.title,
    ]);
    assert.equal(titles.size, 4, 'Every route must have a unique HTML title');

    const descriptions = new Set([
      xongleMeta.description,
      xondditMeta.description,
      aboutMeta.description,
      commMeta.description,
    ]);
    assert.equal(descriptions.size, 4, 'Every route must have a unique meta description');

    // Self-referencing canonical URLs (not canonicalizing everything to homepage)
    assert.equal(xongleMeta.canonicalUrl, `${DEFAULT_PRODUCTION_DOMAIN}/`);
    assert.equal(xondditMeta.canonicalUrl, `${DEFAULT_PRODUCTION_DOMAIN}/?app=xonddit`);
    assert.equal(aboutMeta.canonicalUrl, `${DEFAULT_PRODUCTION_DOMAIN}/about`);
    assert.equal(
      commMeta.canonicalUrl,
      `${DEFAULT_PRODUCTION_DOMAIN}/?app=xonddit&c=technology`
    );

    // JSON-LD validation
    const parsedLd = JSON.parse(safeSerializeJsonLd(xondditMeta.jsonLd));
    assert.equal(parsedLd['@context'], 'https://schema.org');
    assert.ok(Array.isArray(parsedLd['@graph']));
    const types = parsedLd['@graph'].map((node: any) => node['@type']);
    assert.ok(types.includes('Organization'));
    assert.ok(types.includes('WebSite'));
    assert.ok(types.includes('SoftwareApplication'));
    assert.ok(types.includes('BreadcrumbList'));
  });

  it('marks internal search result queries (?q=...) as noindex, follow and canonicalizes to root', () => {
    const searchMeta = resolveSeoMetadata({ app: 'xongle', query: 'typescript performance' });
    assert.equal(searchMeta.robots, 'noindex, follow');
    assert.equal(searchMeta.canonicalUrl, `${DEFAULT_PRODUCTION_DOMAIN}/`);
  });

  it('supports multi-language SEO with localized titles, RTL direction for Arabic, and reciprocal hreflang links', () => {
    const uzMeta = resolveSeoMetadata({ app: 'xonddit', lang: 'uz' });
    const arMeta = resolveSeoMetadata({ app: 'xongle', lang: 'ar' });

    assert.equal(uzMeta.lang, 'uz');
    assert.equal(uzMeta.dir, 'ltr');
    assert.equal(uzMeta.canonicalUrl, `${DEFAULT_PRODUCTION_DOMAIN}/?app=xonddit&lang=uz`);
    assert.ok(uzMeta.hreflangs.some((h) => h.hreflang === 'x-default'));
    assert.ok(uzMeta.hreflangs.some((h) => h.hreflang === 'uz' && h.href === uzMeta.canonicalUrl));

    assert.equal(arMeta.lang, 'ar');
    assert.equal(arMeta.dir, 'rtl');
    assert.equal(arMeta.locale, 'ar_AR');
  });

  it('injects route-specific metadata into index.html without duplicate tags', () => {
    const rawHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
    const meta = resolveSeoMetadata({ app: 'xonddit', lang: 'en' });
    const rendered = injectSeoIntoHtml(rawHtml, meta, [
      {
        slug: 'general',
        name: 'General Discussion',
        description: 'Open community threads',
        lastmod: '2026-10-20',
      },
    ]);

    const titleMatches = rendered.match(/<title>/g) || [];
    const canonicalMatches = rendered.match(/<link rel="canonical"/g) || [];
    const ldMatches = rendered.match(/application\/ld\+json/g) || [];

    assert.equal(titleMatches.length, 1, 'Must contain exactly one <title> tag');
    assert.equal(canonicalMatches.length, 1, 'Must contain exactly one canonical link');
    assert.equal(ldMatches.length, 1, 'Must contain exactly one JSON-LD script block');
    assert.match(rendered, /<meta name="google-site-verification"/);
    assert.match(rendered, /property="og:image"/);
    assert.match(rendered, /name="twitter:image"/);
    assert.match(rendered, /href="\/\?app=xonddit&amp;c=general"/);
  });

  it('renders a noindex 404 HTML page for nonexistent routes', () => {
    const html404 = renderNotFoundHtml('/nonexistent-page');
    assert.match(html404, /404 — Page Not Found/);
    assert.match(html404, /content="noindex, nofollow"/);
  });
});
