/**
 * Reply sanitizer for automotive conversations
 * Removes leftover template placeholders like "[dealership city]" and
 * neutralizes any location/address/map/directions references that appear
 * as bracketed placeholders in LLM output.
 */
export function sanitizeAutomotiveReply(input: string): string {
  if (!input) return '';
  let text = String(input);

  // 1) Remove bracketed placeholders that reference location concepts.
  //    Examples:
  //    - "in [dealership city]" -> ""
  //    - "at [address]" -> ""
  //    - "[location details]" -> ""
  const placeholderPattern = /(\b(?:in|at|near|around|located\s+in)\s*)?\[[^\]]*(?:dealership|city|address|location|map|directions)[^\]]*\]/gi;
  text = text.replace(placeholderPattern, (m, preposition) => {
    // Drop the entire segment including the preposition if it exists
    return '';
  });

  // 2) Clean up dangling prepositions that may remain like "We\'re in." -> "We\'re."
  text = text.replace(/\b(?:in|at|near|around|located\s+in)\s*(?=[\.,!?](\s|$)|$)/gi, '');

  // 2a) If a sentence reduced to just "We're in." style, remove the fragment entirely
  text = text.replace(/\bwe(?:['']re| are)\s*(?:right\s*)?(?:in|at|near|around|located\s+in)\s*(?=[\.,!?](\s|$)|$)/gi, '');

  // 2b) If a sentence now starts with a dangling "We're." / "We are." or "We're right." remove it
  text = text.replace(/(^|\n)\s*we(?:['']re| are)\s*(?:right\s*)?[\.!?]\s*/gi, '$1');
  // 2c) Remove dangling "We're," / "We are," at the start of a sentence
  text = text.replace(/(^|\n)\s*we(?:['']re| are)\s*,\s*/gi, '$1');

  // 3) Remove any leftover bare placeholders just in case (generic square-bracket tokens)
  //    Only remove if the token is short and likely a placeholder (<= 40 chars)
  text = text.replace(/\[[^\]]{1,40}\]/g, '');

  // 4) Remove explicit offers to share maps/directions when phrased generically
  text = text.replace(/\b(map|maps|direction|directions)\b[^\n\.]*[\n\.]?/gi, '');

  // 5) Tidy up whitespace and punctuation: collapse spaces, fix spaces before punctuation
  text = text
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,\.\!\?])/g, '$1')
    .replace(/([\.,!?]){2,}/g, '$1')
    .replace(/\s*\n\s*/g, '\n')
    .trim();

  // 6) Remove lines that became empty after sanitization
  let lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // Drop orphaned location sentences like "We're." or "We are."
  lines = lines.filter(l => !/^we\s*(?:['']re| are)\.?$/i.test(l));

  // Remove leading punctuation left at the start of a line after removals
  lines = lines.map(l => l.replace(/^[\.,!?]+\s*/, ''));

  text = lines.join('\n');

  // 7) Final pass: drop or neutralize sentences that reference physical location/address.
  //    We target sentences that clearly refer to OUR location ("we/our/dealership/showroom")
  //    to avoid removing customer-provided locations.
  const locationTokens = /(location|located|address|map|directions|city|town|state|zip|nearby|find us|where we are|where we're|how far|distance|miles? away|mins? away|minutes? away|close by|near me|easy to (get to|find))/i;
  const ourContext = /(we\s*(?:'re| are)|our|dealership|showroom|store|lot|office)/i;
  const addressLike = /(\d{2,5}\s+\w+\s+(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ct|court|ln|lane|hwy|highway)\b)/i;

  const sentences = text
    .split(/(?<=[\.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(Boolean);

  const cleaned = sentences.filter(s => {
    const hasOurCtx = ourContext.test(s);
    const mentionsLocation = locationTokens.test(s) || addressLike.test(s) || /\b(located\s+(in|at)|in\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b/.test(s);

    // Strict blocklist: drop any sentence that pushes in-person directions/location regardless of pronoun context
    const strictBlock = /(come\s+by|stop\s+by|swing\s+by|visit\s+(us|the\s+(dealership|store|lot|showroom))|our\s+address|what\s+is\s+the\s+address|where\s+(are|is)\s+(you|the\s+dealership)|how\s+do\s+i\s+get\s+there|near\s+(me|you)|find\s+us|directions|location)/i.test(s);

    if (strictBlock) return false;
    return !(hasOurCtx && mentionsLocation);
  });

  // If we removed everything by accident, fall back to a neutral, short helper line
  if (cleaned.length === 0) {
    return "Happy to help — want me to set up a quick visit or send a couple options to look over?";
  }

  return cleaned.join(' ');
}
