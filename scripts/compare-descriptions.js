// scripts/compare-descriptions.js
const fs = require('fs');
const path = require('path');

const mdFile = '../timeline-of-terror/timelines/upped/a821bettyong.md';
const content = fs.readFileSync(mdFile, 'utf-8');

// Extract content after YAML frontmatter
const contentAfterYaml = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');

// Remove figure tags and HTML tags
let description = contentAfterYaml
  .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '')
  .replace(/<[^>]+>/g, '')
  .trim();

// Remove link references from bottom (lines like [1]: https://...)
description = description.replace(/^\[\d+\]:\s*.+$/gm, '').trim();

// Clean up multiple consecutive newlines
description = description.replace(/\n{3,}/g, '\n\n').trim();

// Convert **text** to <strong>text</strong>
description = description.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

// Remove section headers that end with " - "
// These are lines like "**Ong Describes Hijacking but Gives Wrong Flight Number** - "
description = description.replace(/<strong>([^<]+)<\/strong>\s*-\s*/g, '<strong>$1</strong>\n\n');

console.log('=== EXPECTED DESCRIPTION (from markdown) ===\n');
console.log(description);
console.log('\n\n=== Length:', description.length);
console.log('\n\n=== CURRENT DESCRIPTION (from database) ===\n');
console.log('Betty Ong, a flight attendant on Flight 11, begins relaying information about the trouble on her plane to employees at the American Airlines Southeastern Reservations Office in Cary, North Carolina. [1] [2] [1] [4] [5]  [6] [7] [5] [4] [5] [4] [12] [4] [12] [15] [16] [17] [2] [19]');
console.log('\n\n=== Length: 281');
