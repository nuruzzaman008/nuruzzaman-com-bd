/**
 * A URL slug from whatever was typed: "Basic English Sound" becomes
 * "basic-english-sound".
 *
 * Lower case, because the path of a URL is case-sensitive - /courses/Basic-
 * English-Sound and /courses/basic-english-sound would be two addresses for
 * one page, splitting its links and search ranking - and because the API
 * accepts only lower-case letters, digits and hyphens.
 *
 * Accents are dropped ("Café" gives "cafe"). Letters with no Latin form, such
 * as Bengali, are removed, so a Bengali-only title gives an empty slug for the
 * caller to ask about rather than a slug the API would refuse.
 */
export function slugify(text: string, maxLength = 180): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/, '');
}
