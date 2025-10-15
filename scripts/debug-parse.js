// scripts/debug-parse.js - Debug parsing to see what's happening
const fs = require('fs');
const path = require('path');

// Parse History Commons markdown format (similar to parse-file/route.ts)
function parseHistoryCommonsMarkdown(content) {
  console.log('=== STEP 1: Extract YAML ===');
  // Extract YAML frontmatter
  const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const yamlContent = yamlMatch ? yamlMatch[1] : '';
  console.log('YAML content length:', yamlContent.length);

  // Parse YAML fields
  const titleMatch = yamlContent.match(/^title:\s*(.+)$/m);
  const eventTitle = titleMatch ? titleMatch[1].trim() : 'Untitled Event';
  console.log('Title:', eventTitle);

  console.log('\n=== STEP 2: Extract content after YAML ===');
  // Extract main content (everything after YAML frontmatter)
  const contentAfterYaml = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
  console.log('Content after YAML length:', contentAfterYaml.length);
  console.log('First 500 chars:\n', contentAfterYaml.substring(0, 500));

  console.log('\n=== STEP 3: Remove figures and HTML ===');
  // Remove HTML tags from description (but keep the text content)
  let description = contentAfterYaml
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
  console.log('After removing HTML, length:', description.length);
  console.log('First 500 chars:\n', description.substring(0, 500));

  console.log('\n=== STEP 4: Convert **text** to <strong> ===');
  // Convert **text** to <strong>text</strong> for bold formatting
  description = description.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  console.log('After bold conversion, length:', description.length);

  console.log('\n=== STEP 5: Remove link references ===');
  // Remove ALL link references from description
  const beforeLinkRemoval = description.length;
  description = description.replace(/^\[\d+\]:\s*.+$/gm, '').trim();
  console.log('After link removal, length:', description.length, '(removed', beforeLinkRemoval - description.length, 'chars)');

  console.log('\n=== STEP 6: Clean up newlines ===');
  // Clean up multiple consecutive newlines
  description = description.replace(/\n{3,}/g, '\n\n').trim();
  console.log('After newline cleanup, length:', description.length);

  console.log('\n=== STEP 7: Handle inline citations ===');
  // Extract inline citations and replace with [N] markers
  // Use negative lookahead to match everything inside [[ ]] without matching nested [[
  const beforeCitations = description.length;
  description = description.replace(/\[\[((?:(?!\[\[)[\s\S])*?)\]\]/g, (match, content) => {
    console.log('  Matched citation (full):', match);
    console.log('  Content captured:', content);
    // Extract all [N] numbers from the citation block
    const numbers = [];
    const numberPattern = /\]\[(\d+)/g;
    let numMatch;

    while ((numMatch = numberPattern.exec(content)) !== null) {
      console.log('    Found number:', numMatch[1]);
      numbers.push(`[${numMatch[1]}]`);
    }

    const result = numbers.join(' ');
    console.log('    -> Final replacement:', result);
    return result;
  });
  console.log('After citation replacement, length:', description.length, '(changed by', description.length - beforeCitations, 'chars)');

  console.log('\n=== FINAL DESCRIPTION ===');
  console.log('Length:', description.length);
  console.log('First 1000 chars:\n', description.substring(0, 1000));

  return {
    title: eventTitle,
    description,
  };
}

const filePath = '../timeline-of-terror/timelines/upped/a821bettyong.md';
const content = fs.readFileSync(filePath, 'utf-8');
console.log('File length:', content.length);
console.log('\n');

const result = parseHistoryCommonsMarkdown(content);
console.log('\n=== RESULT ===');
console.log('Title:', result.title);
console.log('Description length:', result.description.length);
