import { describe, expect, it } from 'vitest';

import { analyzeSeo, type SeoInput } from '@/lib/seo-analysis/analyze';
import { getDictionary } from '@/lib/i18n/dictionary';

/* The findings are worded from the dictionary; these tests assert on the
   check ids and statuses, so either language would do. */
const t = getDictionary('bn');

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
  return analyzeSeo(input, t)
    .groups.flatMap((group) => group.checks)
    .find((check) => check.id === id);
}

describe('analyzeSeo', () => {
  it('skips every keyword check when no focus keyword is set', () => {
    const result = analyzeSeo({ ...base, focusKeyword: '' }, t);
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

  it('finds a power word in either language and warns when there is none', () => {
    expect(find({ ...base, metaTitle: 'ধাপে ধাপে পাঞ্চিং শিয়ার' }, 'title-power-word')?.status)
      .toBe('pass');
    expect(find({ ...base, metaTitle: 'The complete punching shear check' }, 'title-power-word')?.status)
      .toBe('pass');
    expect(find({ ...base, metaTitle: 'পাঞ্চিং শিয়ার হিসাব' }, 'title-power-word')?.status)
      .toBe('warn');
  });

  it('does not find a Latin power word inside a longer word', () => {
    // "free" must not fire on "freelance", or the check is decoration.
    expect(find({ ...base, metaTitle: 'A freelance punching shear service' }, 'title-power-word')?.status)
      .toBe('warn');
    expect(find({ ...base, metaTitle: 'A free punching shear checklist' }, 'title-power-word')?.status)
      .toBe('pass');
  });

  it('reads sentiment in a title from either direction', () => {
    expect(find({ ...base, metaTitle: 'সেরা পাঞ্চিং শিয়ার পদ্ধতি' }, 'title-sentiment')?.status)
      .toBe('pass');
    // Negative counts too: "mistakes" is as clickable as "best".
    expect(find({ ...base, metaTitle: 'Punching shear mistakes to avoid' }, 'title-sentiment')?.status)
      .toBe('pass');
    expect(find({ ...base, metaTitle: 'পাঞ্চিং শিয়ার হিসাবের ধাপ' }, 'title-sentiment')?.status)
      .toBe('warn');
  });

  it('skips the keyword-reuse check until the API has answered', () => {
    // An unanswered question must not read as a pass - that would tell an
    // author the keyword is theirs alone when nothing has been checked.
    expect(find(base, 'keyword-unique')).toBeUndefined();
    expect(find({ ...base, keywordUsedBy: [] }, 'keyword-unique')?.status).toBe('pass');

    const clash = find({ ...base, keywordUsedBy: [{ title: 'পুরোনো লেখা' }] }, 'keyword-unique');
    expect(clash?.status).toBe('fail');
    expect(clash?.message).toContain('পুরোনো লেখা');
  });

  it('asks for a table of contents only once the piece is long', () => {
    const short = { ...base, content: `${'শব্দ '.repeat(300)}` };
    const long = { ...base, content: `${'শব্দ '.repeat(1200)}` };

    expect(find(short, 'table-of-contents')).toBeUndefined();
    expect(find(long, 'table-of-contents')?.status).toBe('warn');

    const withToc = {
      ...base,
      content: `[এক](#one) [দুই](#two) [তিন](#three)

${'শব্দ '.repeat(1200)}`,
    };
    expect(find(withToc, 'table-of-contents')?.status).toBe('pass');
  });

  it('checks the featured image only where one can be set', () => {
    // No featuredImage given: a surface that cannot set one is not failed for it.
    expect(find(base, 'featured-image')).toBeUndefined();

    // An article still shows generated cover art, so no upload is a warning;
    // a product shows nothing at all, so there it is a failure.
    expect(find({ ...base, featuredImage: null }, 'featured-image')?.status).toBe('warn');
    expect(
      find({ ...base, kind: 'product', featuredImage: null }, 'featured-image')?.status,
    ).toBe('fail');
    // A course page shows no image either; its generated art is only on cards.
    expect(
      find({ ...base, kind: 'course', featuredImage: null }, 'featured-image')?.status,
    ).toBe('fail');
    expect(find({ ...base, featuredImage: { alt: null } }, 'featured-image')?.status).toBe('warn');
    expect(find({ ...base, featuredImage: { alt: '   ' } }, 'featured-image')?.status).toBe('warn');
    expect(
      find({ ...base, featuredImage: { alt: 'পাঞ্চিং শিয়ার চিত্র' } }, 'featured-image')?.status,
    ).toBe('pass');
  });

  it('counts the featured image alt towards the keyword-in-alt check', () => {
    const prose = { ...base, content: 'শুধু লেখা, কোনো ছবি নেই।' };

    // No image anywhere: nothing to check.
    expect(find(prose, 'keyword-in-alt')).toBeUndefined();

    expect(
      find({ ...prose, featuredImage: { alt: 'পাঞ্চিং শিয়ার ডায়াগ্রাম' } }, 'keyword-in-alt')?.status,
    ).toBe('pass');
    expect(find({ ...prose, featuredImage: { alt: 'অন্য কিছু' } }, 'keyword-in-alt')?.status).toBe(
      'warn',
    );
  });

  it('scores a page without a featured image lower than one with it', () => {
    const without = analyzeSeo({ ...base, featuredImage: null }, t);
    const withImage = analyzeSeo({ ...base, featuredImage: { alt: 'পাঞ্চিং শিয়ার চিত্র' } }, t);

    expect(withImage.score).toBeGreaterThan(without.score);
  });

  it('warns about an H1 typed into the body, and only then', () => {
    expect(find({ ...base, content: '# A second title\n\nText.' }, 'body-h1')?.status).toBe('warn');
    expect(find({ ...base, content: '<h1>Another</h1>' }, 'body-h1')?.status).toBe('warn');
    expect(find({ ...base, content: '## A section\n\nText.' }, 'body-h1')).toBeUndefined();
    // A comment line inside a code block is not a heading.
    expect(find({ ...base, content: '```\n# not a heading\n```' }, 'body-h1')).toBeUndefined();
  });

  it('scores a warning as half a pass, not as a failure', () => {
    const strong = analyzeSeo({
      ...base,
      content: `## পাঞ্চিং শিয়ার\n\n${'শব্দ '.repeat(700)}\n\n[উৎস](https://example.org) [ভেতরে](/blog/x)\n\n![পাঞ্চিং শিয়ার চিত্র](/img/a.png)`,
    }, t);
    const weak = analyzeSeo({ ...base, content: 'অল্প কথা।' }, t);

    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.score).toBeLessThanOrEqual(100);
    expect(weak.score).toBeGreaterThanOrEqual(0);
  });
});
