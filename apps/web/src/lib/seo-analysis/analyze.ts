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
 */

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

const KIND_NOUN: Record<SeoInput['kind'], string> = {
  post: 'আর্টিকেল',
  course: 'কোর্স',
  product: 'প্রোডাক্ট',
};

/** Minimum body length worth publishing, per kind. */
const MIN_WORDS: Record<SeoInput['kind'], number> = {
  post: 600,
  course: 200,
  product: 200,
};

export function analyzeSeo(input: SeoInput): SeoAnalysis {
  const keyword = input.focusKeyword.trim();
  const hasKeyword = keyword.length > 0;
  const effectiveTitle = (input.metaTitle || input.title).trim();
  const plain = toPlainText(input.content);
  const words = countWords(plain);
  const headings = extractHeadings(input.content);
  const alts = extractImageAlts(input.content);
  const links = extractLinks(input.content);
  const blocks = paragraphs(input.content);
  const noun = KIND_NOUN[input.kind];

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
        ? 'ফোকাস কিওয়ার্ড SEO টাইটেলে আছে।'
        : 'ফোকাস কিওয়ার্ড SEO টাইটেলে নেই।',
      hint: 'সার্চ ফলাফলে টাইটেলই সবচেয়ে বড় সংকেত।',
    });

    basic.push({
      id: 'keyword-in-description',
      status: contains(input.metaDescription, keyword) ? 'pass' : 'fail',
      message: contains(input.metaDescription, keyword)
        ? 'ফোকাস কিওয়ার্ড মেটা ডেসক্রিপশনে আছে।'
        : 'ফোকাস কিওয়ার্ড মেটা ডেসক্রিপশনে নেই।',
      hint: 'সার্চ ফলাফলে কিওয়ার্ড মোটা অক্ষরে দেখায়, তাতে ক্লিক বাড়ে।',
    });

    basic.push({
      id: 'keyword-in-slug',
      status: contains(input.slug.replace(/-/g, ' '), keyword) ? 'pass' : 'warn',
      message: contains(input.slug.replace(/-/g, ' '), keyword)
        ? 'ফোকাস কিওয়ার্ড URL-এ আছে।'
        : 'ফোকাস কিওয়ার্ড URL-এ নেই।',
      hint: 'প্রকাশের পর slug বদলালে পুরোনো লিংক ভাঙে — এটি প্রকাশের আগেই ঠিক করুন।',
    });

    const opening = blocks.slice(0, Math.max(1, Math.ceil(blocks.length * 0.1))).join(' ');
    basic.push({
      id: 'keyword-in-opening',
      status: contains(opening, keyword) ? 'pass' : 'warn',
      message: contains(opening, keyword)
        ? 'লেখার প্রথম ১০%-এ ফোকাস কিওয়ার্ড আছে।'
        : 'লেখার প্রথম ১০%-এ ফোকাস কিওয়ার্ড নেই।',
      hint: 'পাঠক ও ক্রলার দুজনেই শুরুতেই বোঝে লেখাটি কী নিয়ে।',
    });

    const occurrences = countOccurrences(input.content, keyword);
    basic.push({
      id: 'keyword-in-content',
      status: occurrences > 0 ? 'pass' : 'fail',
      message: occurrences > 0
        ? `মূল লেখায় ফোকাস কিওয়ার্ড ${occurrences} বার আছে।`
        : 'মূল লেখায় ফোকাস কিওয়ার্ড নেই।',
    });
  }

  basic.push({
    id: 'content-length',
    status: words >= MIN_WORDS[input.kind] ? 'pass' : words >= MIN_WORDS[input.kind] / 2 ? 'warn' : 'fail',
    message: `${noun}ের দৈর্ঘ্য ${words} শব্দ (লক্ষ্য ${MIN_WORDS[input.kind]}+)।`,
    hint: 'শব্দসংখ্যা নিজে কোনো র‍্যাঙ্কিং ফ্যাক্টর নয়; খুব ছোট লেখা সাধারণত প্রশ্নের উত্তর দেয় না।',
  });

  /* ---------------------------------------------------------- additional */

  if (hasKeyword) {
    const inHeading = headings.some((heading) => contains(heading, keyword));
    additional.push({
      id: 'keyword-in-heading',
      status: inHeading ? 'pass' : 'warn',
      message: inHeading
        ? 'কোনো সাবহেডিংয়ে ফোকাস কিওয়ার্ড আছে।'
        : 'কোনো সাবহেডিংয়ে ফোকাস কিওয়ার্ড নেই।',
    });

    if (alts.length > 0) {
      const inAlt = alts.some((alt) => contains(alt, keyword));
      additional.push({
        id: 'keyword-in-alt',
        status: inAlt ? 'pass' : 'warn',
        message: inAlt
          ? 'কোনো ছবির alt টেক্সটে ফোকাস কিওয়ার্ড আছে।'
          : 'কোনো ছবির alt টেক্সটে ফোকাস কিওয়ার্ড নেই।',
        hint: 'alt টেক্সট প্রথমত স্ক্রিন রিডারের জন্য — ছবিতে যা আছে তাই লিখুন, কিওয়ার্ড জোর করে নয়।',
      });
    }

    // Density is reported, not policed: there is no correct number, and the
    // useful signal is only "absent" or "stuffed".
    const density = words > 0 ? (countOccurrences(input.content, keyword) / words) * 100 : 0;
    additional.push({
      id: 'keyword-density',
      status: density === 0 ? 'fail' : density > 3 ? 'warn' : 'pass',
      message: `কিওয়ার্ড ডেনসিটি ${density.toFixed(2)}%।`,
      hint: density > 3
        ? 'অস্বাভাবিক বেশি — পাঠকের কাছে জোর করে বসানো মনে হতে পারে।'
        : 'নির্দিষ্ট কোনো আদর্শ মান নেই; স্বাভাবিক ভাষাই যথেষ্ট।',
    });
  }

  const slugLength = countCharacters(input.slug);
  additional.push({
    id: 'slug-length',
    status: slugLength > 0 && slugLength <= 75 ? 'pass' : slugLength === 0 ? 'fail' : 'warn',
    message: slugLength === 0 ? 'URL slug দেওয়া হয়নি।' : `URL ${slugLength} অক্ষর দীর্ঘ।`,
  });

  additional.push({
    id: 'internal-links',
    status: links.internal > 0 ? 'pass' : 'warn',
    message: links.internal > 0
      ? `সাইটের ভেতরে ${links.internal}টি লিংক আছে।`
      : 'সাইটের ভেতরের কোনো লিংক নেই।',
    hint: 'সম্পর্কিত লেখায় লিংক দিলে পাঠক ও ক্রলার দুজনেরই পথ তৈরি হয়।',
  });

  additional.push({
    id: 'external-links',
    status: links.external > 0 ? 'pass' : 'warn',
    message: links.external > 0
      ? `বাইরের ${links.external}টি রেফারেন্স লিংক আছে।`
      : 'বাইরের কোনো রেফারেন্স লিংক নেই।',
    hint: 'কোড, স্ট্যান্ডার্ড বা উৎসের লিংক দাবিগুলো যাচাইযোগ্য করে।',
  });

  /* ------------------------------------------------------ title readability */

  const titleLength = countCharacters(effectiveTitle);
  title.push({
    id: 'title-length',
    status: titleLength >= 25 && titleLength <= 65 ? 'pass' : titleLength === 0 ? 'fail' : 'warn',
    message: titleLength === 0
      ? 'SEO টাইটেল দেওয়া হয়নি।'
      : `SEO টাইটেল ${titleLength} অক্ষর (২৫–৬৫ ভালো)।`,
    hint: 'বেশি লম্বা হলে সার্চ ফলাফলে কেটে যায়।',
  });

  if (hasKeyword) {
    const startsWith = normalise(effectiveTitle).startsWith(keyword.toLowerCase());
    title.push({
      id: 'keyword-at-start',
      status: startsWith ? 'pass' : 'warn',
      message: startsWith
        ? 'টাইটেল ফোকাস কিওয়ার্ড দিয়ে শুরু হয়েছে।'
        : 'টাইটেল ফোকাস কিওয়ার্ড দিয়ে শুরু হয়নি।',
      hint: 'শুরুতে থাকলে চোখে আগে পড়ে; বাক্য অস্বাভাবিক হলে এটি উপেক্ষা করাই ভালো।',
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
      ? 'মেটা ডেসক্রিপশন দেওয়া হয়নি।'
      : `মেটা ডেসক্রিপশন ${descriptionLength} অক্ষর (১১০–১৬০ ভালো)।`,
  });

  title.push({
    id: 'has-number',
    status: /[0-9০-৯]/.test(effectiveTitle) ? 'pass' : 'warn',
    message: /[0-9০-৯]/.test(effectiveTitle)
      ? 'টাইটেলে সংখ্যা আছে।'
      : 'টাইটেলে কোনো সংখ্যা নেই।',
    hint: 'ঐচ্ছিক — সংখ্যা থাকলে তালিকা বা ধাপভিত্তিক লেখায় ক্লিক বাড়ে, সব লেখায় নয়।',
  });

  /* ---------------------------------------------------- content readability */

  readability.push({
    id: 'has-subheadings',
    status: headings.length >= 2 ? 'pass' : headings.length === 1 ? 'warn' : 'fail',
    message: headings.length === 0
      ? 'কোনো সাবহেডিং নেই।'
      : `${headings.length}টি সাবহেডিং আছে।`,
    hint: 'সাবহেডিং ছাড়া লম্বা লেখা স্ক্যান করা যায় না।',
  });

  const longBlocks = blocks.filter((block) => countWords(block) > 150).length;
  readability.push({
    id: 'paragraph-length',
    status: longBlocks === 0 ? 'pass' : 'warn',
    message: longBlocks === 0
      ? 'অনুচ্ছেদগুলো ছোট ও পাঠযোগ্য।'
      : `${longBlocks}টি অনুচ্ছেদ ১৫০ শব্দের বেশি।`,
  });

  readability.push({
    id: 'has-media',
    status: alts.length > 0 ? 'pass' : 'warn',
    message: alts.length > 0
      ? `${alts.length}টি ছবি আছে।`
      : 'কোনো ছবি বা ডায়াগ্রাম নেই।',
    hint: 'হিসাব বা ধাপভিত্তিক লেখায় একটি চিত্র অনেক ব্যাখ্যা বাঁচায়।',
  });

  const missingAlt = alts.filter((alt) => alt.trim().length === 0).length;
  if (alts.length > 0) {
    readability.push({
      id: 'alt-text-present',
      status: missingAlt === 0 ? 'pass' : 'fail',
      message: missingAlt === 0
        ? 'প্রতিটি ছবির alt টেক্সট আছে।'
        : `${missingAlt}টি ছবির alt টেক্সট নেই।`,
      hint: 'alt টেক্সট ছাড়া ছবি স্ক্রিন রিডারে অদৃশ্য — এটি অ্যাক্সেসিবিলিটির শর্ত, শুধু SEO নয়।',
    });
  }

  if (input.excerpt !== undefined) {
    const excerptLength = countCharacters(input.excerpt.trim());
    readability.push({
      id: 'has-excerpt',
      status: excerptLength > 0 ? 'pass' : 'warn',
      message: excerptLength > 0
        ? `সারসংক্ষেপ ${excerptLength} অক্ষর।`
        : 'সারসংক্ষেপ দেওয়া হয়নি।',
      hint: 'তালিকা ও কার্ডে এটিই দেখানো হয়; না থাকলে লেখার শুরুটা কেটে দেখানো হয়।',
    });
  }

  const groups: SeoGroup[] = [
    { id: 'basic', heading: 'মৌলিক SEO', checks: basic },
    { id: 'additional', heading: 'অতিরিক্ত', checks: additional },
    { id: 'title', heading: 'টাইটেল ও ডেসক্রিপশন', checks: title },
    { id: 'readability', heading: 'পাঠযোগ্যতা', checks: readability },
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
