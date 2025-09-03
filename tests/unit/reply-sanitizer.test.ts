import { sanitizeAutomotiveReply } from '../../server/services/reply-sanitizer';

describe('sanitizeAutomotiveReply', () => {
  it('removes [dealership city] with preceding preposition and cleans sentence', () => {
    const input = "We're in [dealership city]. You close by, or checking the drive?";
    const out = sanitizeAutomotiveReply(input);
    expect(out).toMatch(/You close by/);
    expect(out).not.toMatch(/\[dealership city\]/i);
    expect(out).not.toMatch(/We'?re\s*\.?\s*$/i);
  });

  it('drops orphaned opener when phrase collapses, keeps next sentence', () => {
    const input = "We're right in [dealership city]. Easy to get to.";
    const out = sanitizeAutomotiveReply(input);
    expect(out).toBe("Easy to get to.");
  });

  it('removes generic location placeholders like [map] and [directions]', () => {
    const input = "See our [map] if needed. We can send [directions].";
    const out = sanitizeAutomotiveReply(input);
    expect(out).not.toMatch(/\[map\]|\[directions\]/i);
  });

  it('tidies punctuation and whitespace after removals', () => {
    const input = "We are at [address] , ready to help!";
    const out = sanitizeAutomotiveReply(input);
    expect(out).toBe("ready to help!");
  });
});