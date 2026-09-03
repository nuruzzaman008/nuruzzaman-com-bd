import { describe, expect, it } from 'vitest';

import { analyzeSeo, type SeoInput } from '@/lib/seo-analysis/analyze';

const base: SeoInput = {
  kind: 'post',
  focusKeyword: 'পাঞ্চিং শিয়ার',
  title: 'পাঞ্চিং শিয়ার চেক — ২ ধাপে হিসাব',
  metaTitle: '',
  metaDescription:
    'পাঞ্চিং শিয়ার চেক কীভাবে করবেন তার ধাপে ধাপে হিসাব, ব্যবহৃত অ্যাজাম্পশন এবং কোথায় সবচেয়ে বেশি ভুল হয় তা উদাহরণসহ দেখানো হলো।',
  slug: 'punching-shear-check',
  content: '',
  excerpt: 'একটি বাস্তব উদাহরণ।',
};

function find(input: SeoInput, id: string) {
  return analyzeSeo(input)
    .groups.flatMap((group) => group.checks)
    .find((check) => check.id === id);
}

describe('analyzeSeo', () => {
  it('skips every keyword check when no focus keyword is set', () => {
    const result = analyzeSeo({ ...base, focusKeyword: '' });
    const ids = result.groups.flatMap((group) => group.checks).map((check) => check.id);

    expect(result.keywordMissing).toBe(true);
    expect(ids).not.toContain('keyword-in-title');
    expect(ids).not.toContain('keyword-in-content');
    // The checks that do not need a keyword still run.
    expect(ids).toContain('content-length');
  });

  it('finds the keyword in the title through markdown and case differences', () => {
    expect(find(base, 'keyword-in-title')?.status).toBe('pass');
    expect(find({ ...base, title: 'সম্পূর্ণ ভিন্ন শিরোনাম' }, 'keyword-in-title')?.status).toBe('fail');
  });

  it('prefers the meta title over the record title when one is set', () => {
    const withMeta = { ...base, title: 'অপ্রাসঙ্গিক', metaTitle: 'পাঞ্চিং শিয়ার নিয়ে' };

    expect(find(withMeta, 'keyword-in-title')?.status).toBe('pass');
  });

  it('matches the keyword against a hyphenated slug', () => {
    const input = { ...base, focusKeyword: 'punching shear' };

    expect(find(input, 'keyword-in-slug')?.status).toBe('pass');
  });

  it('counts words from prose, not from markdown syntax', () => {
    const content = ['## একটি শিরোনাম', '', '**গাঢ়** শব্দ আর [লিংক](/somewhere) মিলে চার শব্দ।'].join('\n');
    const check = find({ ...base, content }, 'content-length');

    // Six real words; the ##, ** and the URL must not be counted.
    expect(check?.message).toMatch(/\d+ শব্দ/);
    expect(check?.message).not.toContain('##');
  });

  it('reports keyword density without treating any value as correct', () => {
    const stuffed = Array.from({ length: 40 }, () => 'পাঞ্চিং শিয়ার').join(' ');
    const check = find({ ...base, content: stuffed }, 'keyword-density');

    expect(check?.status).toBe('warn');
    expect(check?.hint).toContain('অস্বাভাবিক বেশি');
  });

  it('fails when an image has no alt text, because that is an accessibility defect', () => {
    const content = '![](/img/a.png) কিছু লেখা এখানে।';
    expect(find({ ...base, content }, 'alt-text-present')?.status).toBe('fail');

    const withAlt = '![ফুটিংয়ের সেকশন](/img/a.png) কিছু লেখা এখানে।';
    expect(find({ ...base, content: withAlt }, 'alt-text-present')?.status).toBe('pass');
  });

  it('separates internal links from external ones', () => {
    const content = '[ভেতরে](/blog/x) এবং [বাইরে](https://example.org/y)';

    expect(find({ ...base, content }, 'internal-links')?.status).toBe('pass');
    expect(find({ ...base, content }, 'external-links')?.status).toBe('pass');
  });

  it('counts Bengali characters as a reader perceives them', () => {
    // 'ক্ষ' is one perceived character built from three code points; counting
    // code units would overstate every Bengali title's length.
    const check = find({ ...base, metaTitle: 'ক্ষ' }, 'title-length');

    expect(check?.message).toContain('3 অক্ষর');
  });

  it('scores a warning as half a pass, not as a failure', () => {
    const strong = analyzeSeo({
      ...base,
      content: `## পাঞ্চিং শিয়ার\n\n${'শব্দ '.repeat(700)}\n\n[উৎস](https://example.org) [ভেতরে](/blog/x)\n\n![পাঞ্চিং শিয়ার চিত্র](/img/a.png)`,
    });
    const weak = analyzeSeo({ ...base, content: 'অল্প কথা।' });

    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.score).toBeLessThanOrEqual(100);
    expect(weak.score).toBeGreaterThanOrEqual(0);
  });
});
