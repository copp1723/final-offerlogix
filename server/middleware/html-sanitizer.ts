const ALLOWED_TAGS = [
  'a','b','i','strong','em','p','br','ul','ol','li','span','div'
];

export function validateTemplateHtml(html: string) {
  const tagRegex = /<\/?([a-z0-9-]+)[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(html))) {
    const tag = match[1].toLowerCase();
    if (!ALLOWED_TAGS.includes(tag)) {
      throw new Error(`Disallowed HTML tag: ${tag}`);
    }
  }
  return html;
}