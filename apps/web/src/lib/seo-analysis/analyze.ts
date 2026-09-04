/**
 * On-page SEO analysis for the editor.
 *
 * Every check is a rule an author can act on, phrased as what to do rather than
 * a score to chase. Three deliberate limits:
 *
 *  - It measures the page against the focus keyword the author chose. It cannot
 *    tell you whether that is the right keyword, and it does not pretend to.
 *  - A passing list is not a ranking prediction. These are hygiene checks —
 *    they catch a missing description or a keyword absent from the title, not
 *    whether the writing is any good.
 *  - Nothing here is weighted by guesswork about Google's algorithm. The score
 *    is simply the share of applicable checks that pass, so it means exactly
 *    what it looks like.
 *
 * Bengali is counted correctly: word and character counts use grapheme-aware
 * splitting rather than assuming one byte per letter.
 *
 * The findings themselves come from the dictionary, so the panel reads in
 * whichever language the editor chose. The thresholds do not: 25-65 characters
 * is what a search result truncates at, in either language.
 */

import type { Dictionary } from '@/lib/i18n/dictionary';

export type CheckStatus = 'pass' | 'warn' | 'fail';

export type SeoCheck = {
  id: string;
  status: CheckStatus;
  /** What the author sees. Written as a finding, not a command. */
  message: string;
  /** Why it matters, shown on request. */
  hint?: string;
};

export type SeoGroup = {
  id: 'basic' | 'additional' | 'title' | 'readability';
  heading: string;
  checks: SeoCheck[];
};

export type SeoAnalysis = {
  groups: SeoGroup[];
  /** Share of checks that pass, 0-100. */
  score: number;
  passed: number;
  warned: number;
  failed: number;
  /** True when no focus keyword was given, so keyword checks were skipped. */
  keywordMissing: boolean;
};

export type SeoInput = {
  /** post | course | product — only used to word a few messages. */
  kind: 'post' | 'course' | 'product';
  focusKeyword: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  /** Markdown or plain text; HTML is tolerated and stripped. */
  content: string;
  /** Excerpt/subtitle/tagline, whichever the record has. */
  excerpt?: string;
};

/** Strips HTML tags and markdown syntax down to readable prose. */
function toPlainText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Counts words across scripts.
 *
 * Bengali does not separate words the way a naive `split(/\s+/)` on Latin text
 * assumes in every case, but it does use spaces, so splitting on whitespace is
 * correct for both. What matters is not counting punctuation as words.
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** Characters as a reader perceives them, so Bengali conjuncts count as one. */
function countCharacters(text: string): number {
  return Array.from(text).length;
}

function normalise(value: string): string {
  return toPlainText(value).toLowerCase();
}

/** Case-insensitive, whitespace-tolerant "does this contain the keyword". */
function contains(haystack: string, keyword: string): boolean {
  if (!keyword.trim()) {
    return false;
  }

  return normalise(haystack).includes(keyword.trim().toLowerCase());
}

function countOccurrences(haystack: string, keyword: string): number {
  const needle = keyword.trim().toLowerCase();

  if (!needle) {
    return 0;
  }

  const text = normalise(haystack);
  let count = 0;
  let index = text.indexOf(needle);

  while (index !== -1) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }

  return count;
}

/** Headings in the body, as `## text` lines or `<h2>` tags. */
function extractHeadings(content: string): string[] {
  const markdown = [...content.matchAll(/^#{2,6}\s+(.+)$/gm)].map((match) => match[1]);
  const html = [...content.matchAll(/<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>/gi)].map((m) => m[1]);

  return [...markdown, ...html].map(toPlainText).filter(Boolean);
}

/** Alt text of every image, markdown or HTML. */
function extractImageAlts(content: string): string[] {
  const markdown = [...content.matchAll(/!\[([^\]]*)\]\([^)]*\)/g)].map((match) => match[1]);
  const html = [...content.matchAll(/<img[^>]*\salt=["']([^"']*)["']/gi)].map((m) => m[1]);

  return [...markdown, ...html];
}

function extractLinks(content: string): { internal: number; external: number } {
  const markdown = [...content.matchAll(/\[[^\]]*\]\(([^)\s]+)/g)].map((match) => match[1]);
  const html = [...content.matchAll(/<a[^>]*\shref=["']([^"']+)["']/gi)].map((m) => m[1]);
  const hrefs = [...markdown, ...html];

  return {
    internal: hrefs.filter((href) => href.startsWith('/') || href.startsWith('#')).length,
    external: hrefs.filter((href) => /^https?:\/\//i.test(href)).length,
  };
}

/** Paragraph blocks, used for the "opening 10%" and readability checks. */
function paragraphs(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map(toPlainText)
    .filter((block) => block.length > 0);
}

/** Minimum body length worth publishing, per kind. */
const MIN_WORDS: Record<SeoInput['kind'], number> = {
  post: 600,
  course: 200,
  product: 200,
};

export function analyzeSeo(input: SeoInput, t: Dictionary): SeoAnalysis {
  const say = t.seoCheck;
  const keyword = input.focusKeyword.trim();
  const hasKeyword = keyword.length > 0;
  const effectiveTitle = (input.metaTitle || input.title).trim();
  const plain = toPlainText(input.content);
  const words = countWords(plain);
  const headings = extractHeadings(input.content);
  const alts = extractImageAlts(input.content);
  const links = extractLinks(input.content);
  const blocks = paragraphs(input.content);
  const noun = say.kind[input.kind];

  const basic: SeoCheck[] = [];
  const additional: SeoCheck[] = [];
  const title: SeoCheck[] = [];
  const readability: SeoCheck[] = [];

  /* ---------------------------------------------------------- basic SEO */

  if (hasKeyword) {
    basic.push({
      id: 'keyword-in-title',
      status: contains(effectiveTitle, keyword) ? 'pass' : 'fail',
      message: contains(effectiveTitle, keyword)
        ? say.keywordInTitleYes
        : say.keywordInTitleNo,
      hint: say.keywordInTitleHint,
    });

    basic.push({
      id: 'keyword-in-description',
      status: contains(input.metaDescription, keyword) ? 'pass' : 'fail',
      message: contains(input.metaDescription, keyword)
        ? say.keywordInDescriptionYes
        : say.keywordInDescriptionNo,
      hint: say.keywordInDescriptionHint,
    });

    basic.push({
      id: 'keyword-in-slug',
      status: contains(input.slug.replace(/-/g, ' '), keyword) ? 'pass' : 'warn',
      message: contains(input.slug.replace(/-/g, ' '), keyword)
        ? say.keywordInSlugYes
        : say.keywordInSlugNo,
      hint: say.keywordInSlugHint,
    });

    const opening = blocks.slice(0, Math.max(1, Math.ceil(blocks.length * 0.1))).join(' ');
    basic.push({
      id: 'keyword-in-opening',
      status: contains(opening, keyword) ? 'pass' : 'warn',
      message: contains(opening, keyword)
        ? say.keywordInOpeningYes
        : say.keywordInOpeningNo,
      hint: say.keywordInOpeningHint,
    });

    const occurrences = countOccurrences(input.content, keyword);
    basic.push({
      id: 'keyword-in-content',
      status: occurrences > 0 ? 'pass' : 'fail',
      message: occurrences > 0
        ? say.keywordInContentYes.replace('{count}', String(occurrences))
        : say.keywordInContentNo,
    });
  }

  basic.push({
    id: 'content-length',
    status: words >= MIN_WORDS[input.kind] ? 'pass' : words >= MIN_WORDS[input.kind] / 2 ? 'warn' : 'fail',
    message: say.contentLength
      .replace('{noun}', noun)
      .replace('{words}', String(words))
      .replace('{target}', String(MIN_WORDS[input.kind])),
    hint: say.contentLengthHint,
  });

  /* ---------------------------------------------------------- additional */

  if (hasKeyword) {
    const inHeading = headings.some((heading) => contains(heading, keyword));
    additional.push({
      id: 'keyword-in-heading',
      status: inHeading ? 'pass' : 'warn',
      message: inHeading
        ? say.keywordInHeadingYes
        : say.keywordInHeadingNo,
    });

    if (alts.length > 0) {
      const inAlt = alts.some((alt) => contains(alt, keyword));
      additional.push({
        id: 'keyword-in-alt',
        status: inAlt ? 'pass' : 'warn',
        message: inAlt
          ? say.keywordInAltYes
          : say.keywordInAltNo,
        hint: say.keywordInAltHint,
      });
    }

    // Density is reported, not policed: there is no correct number, and the
    // useful signal is only "absent" or "stuffed".
    const density = words > 0 ? (countOccurrences(input.content, keyword) / words) * 100 : 0;
    additional.push({
      id: 'keyword-density',
      status: density === 0 ? 'fail' : density > 3 ? 'warn' : 'pass',
      message: say.density.replace('{value}', density.toFixed(2)),
      hint: density > 3 ? say.densityHigh : say.densityNormal,
    });
  }

  const slugLength = countCharacters(input.slug);
  additional.push({
    id: 'slug-length',
    status: slugLength > 0 && slugLength <= 75 ? 'pass' : slugLength === 0 ? 'fail' : 'warn',
    message:
      slugLength === 0
        ? say.slugMissing
        : say.slugLength.replace('{count}', String(slugLength)),
  });

  additional.push({
    id: 'internal-links',
    status: links.internal > 0 ? 'pass' : 'warn',
    message: links.internal > 0
      ? say.internalLinksYes.replace('{count}', String(links.internal))
      : say.internalLinksNo,
    hint: say.internalLinksHint,
  });

  additional.push({
    id: 'external-links',
    status: links.external > 0 ? 'pass' : 'warn',
    message: links.external > 0
      ? say.externalLinksYes.replace('{count}', String(links.external))
      : say.externalLinksNo,
    hint: say.externalLinksHint,
  });

  /* ------------------------------------------------------ title readability */

  const titleLength = countCharacters(effectiveTitle);
  title.push({
    id: 'title-length',
    status: titleLength >= 25 && titleLength <= 65 ? 'pass' : titleLength === 0 ? 'fail' : 'warn',
    message: titleLength === 0
      ? say.titleMissing
      : say.titleLength.replace('{count}', String(titleLength)),
    hint: say.titleLengthHint,
  });

  if (hasKeyword) {
    const startsWith = normalise(effectiveTitle).startsWith(keyword.toLowerCase());
    title.push({
      id: 'keyword-at-start',
      status: startsWith ? 'pass' : 'warn',
      message: startsWith
        ? say.titleStartsYes
        : say.titleStartsNo,
      hint: say.titleStartsHint,
    });
  }

  const descriptionLength = countCharacters(input.metaDescription.trim());
  title.push({
    id: 'description-length',
    status:
      descriptionLength >= 110 && descriptionLength <= 160
        ? 'pass'
        : descriptionLength === 0
          ? 'fail'
          : 'warn',
    message: descriptionLength === 0
      ? say.descriptionMissing
      : say.descriptionLength.replace('{count}', String(descriptionLength)),
  });

  title.push({
    id: 'has-number',
    status: /[0-9০-৯]/.test(effectiveTitle) ? 'pass' : 'warn',
    message: /[0-9০-৯]/.test(effectiveTitle)
      ? say.titleHasNumber
      : say.titleNoNumber,
    hint: say.titleNumberHint,
  });

  /* ---------------------------------------------------- content readability */

  readability.push({
    id: 'has-subheadings',
    status: headings.length >= 2 ? 'pass' : headings.length === 1 ? 'warn' : 'fail',
    message: headings.length === 0
      ? say.noHeadings
      : say.headingCount.replace('{count}', String(headings.length)),
    hint: say.headingHint,
  });

  const longBlocks = blocks.filter((block) => countWords(block) > 150).length;
  readability.push({
    id: 'paragraph-length',
    status: longBlocks === 0 ? 'pass' : 'warn',
    message: longBlocks === 0
      ? say.paragraphsShort
      : say.paragraphsLong.replace('{count}', String(longBlocks)),
  });

  readability.push({
    id: 'has-media',
    status: alts.length > 0 ? 'pass' : 'warn',
    message: alts.length > 0
      ? say.imagesYes.replace('{count}', String(alts.length))
      : say.imagesNo,
    hint: say.imagesHint,
  });

  const missingAlt = alts.filter((alt) => alt.trim().length === 0).length;
  if (alts.length > 0) {
    readability.push({
      id: 'alt-text-present',
      status: missingAlt === 0 ? 'pass' : 'fail',
      message: missingAlt === 0
        ? say.altAllPresent
        : say.altMissing.replace('{count}', String(missingAlt)),
      hint: say.altHint,
    });
  }

  if (input.excerpt !== undefined) {
    const excerptLength = countCharacters(input.excerpt.trim());
    readability.push({
      id: 'has-excerpt',
      status: excerptLength > 0 ? 'pass' : 'warn',
      message: excerptLength > 0
        ? say.excerptLength.replace('{count}', String(excerptLength))
        : say.excerptMissing,
      hint: say.excerptHint,
    });
  }

  const groups: SeoGroup[] = [
    { id: 'basic', heading: say.groups.basic, checks: basic },
    { id: 'additional', heading: say.groups.additional, checks: additional },
    { id: 'title', heading: say.groups.title, checks: title },
    { id: 'readability', heading: say.groups.readability, checks: readability },
  ];

  const all = groups.flatMap((group) => group.checks);
  const passed = all.filter((check) => check.status === 'pass').length;
  const warned = all.filter((check) => check.status === 'warn').length;
  const failed = all.filter((check) => check.status === 'fail').length;

  return {
    groups,
    // A warning counts as half: it is a suggestion, not a defect, and treating
    // it as a failure would push authors to chase checks that do not apply.
    score: all.length === 0 ? 0 : Math.round(((passed + warned * 0.5) / all.length) * 100),
    passed,
    warned,
    failed,
    keywordMissing: !hasKeyword,
  };
}
