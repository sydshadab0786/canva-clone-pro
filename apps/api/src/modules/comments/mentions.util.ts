/**
 * Parse @mentions from a comment body. Usernames match the same rule as the
 * profile validator (3–30 chars, alphanumeric/underscore). Pure + tested.
 */
const MENTION_RE = /(?:^|[^\w@])@([a-zA-Z0-9_]{3,30})\b/g;

export function parseMentions(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(MENTION_RE)) {
    if (match[1]) found.add(match[1].toLowerCase());
  }
  return [...found];
}
