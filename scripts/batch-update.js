// scripts/batch-update.js - Update existing events with corrected descriptions and footnotes
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Define Event schema inline - exactly matching the TypeScript model
const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300,
  },
  description: {
    type: String,
    // Remove maxlength for batch updates to allow fixing existing data
  },
  startDateTime: {
    type: Date,
    required: true,
  },
  endDateTime: {
    type: Date,
  },
  importance: {
    type: Number,
    enum: [1, 2, 3, 4, 5],
    default: 3,
  },
  thumbnailUrl: {
    type: String,
    maxlength: 500,
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
  },
  timelineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Timeline',
    required: true,
  },
  chainIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Chain',
    default: [],
  },
  footnotes: {
    type: [{
      number: { type: Number, required: true },
      type: { type: String, enum: ['link', 'attachment'], required: true },
      referenceId: { type: mongoose.Schema.Types.ObjectId, required: true },
      pageRange: { type: String },
      customSource: { type: String },
      date: { type: String },
    }],
    default: [],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true });

// Define Link schema inline
const LinkSchema = new mongoose.Schema({
  title: String,
  url: String,
  createdBy: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

// Define LinkLink schema inline (junction table for many-to-many)
const LinkLinkSchema = new mongoose.Schema({
  linkId: mongoose.Schema.Types.ObjectId,
  eventId: mongoose.Schema.Types.ObjectId,
  entityId: mongoose.Schema.Types.ObjectId,
  createdBy: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

// Clear any existing models to avoid conflicts
if (mongoose.models.Event) delete mongoose.models.Event;
if (mongoose.models.Link) delete mongoose.models.Link;
if (mongoose.models.LinkLink) delete mongoose.models.LinkLink;

const Event = mongoose.model('Event', EventSchema);
const Link = mongoose.model('Link', LinkSchema);
const LinkLink = mongoose.model('LinkLink', LinkLinkSchema);

// Parse History Commons markdown format (similar to parse-file/route.ts)
function parseHistoryCommonsMarkdown(content) {
  // Extract YAML frontmatter
  const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const yamlContent = yamlMatch ? yamlMatch[1] : '';

  // Parse YAML fields
  const titleMatch = yamlContent.match(/^title:\s*(.+)$/m);
  const eventTitle = titleMatch ? titleMatch[1].trim() : 'Untitled Event';

  const timeMatch = yamlContent.match(/^time:\s*(.+)$/m);
  const eventTime = timeMatch ? timeMatch[1].trim() : null;

  // Extract main content (everything after YAML frontmatter)
  const contentAfterYaml = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');

  // Remove HTML tags from description (but keep the text content)
  let description = contentAfterYaml
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();

  // Convert **text** to <strong>text</strong> for bold formatting
  description = description.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Extract all link references from bottom: [N]: URL
  const linkReferences = new Map(); // number -> url
  const linkMatches = description.matchAll(/^\[(\d+)\]:\s*(https?:\/\/[^\s]+)$/gm);
  for (const match of linkMatches) {
    const num = parseInt(match[1], 10);
    const url = match[2];
    linkReferences.set(num, url);
  }

  // Remove ALL link references from description (both valid http(s) and malformed ones like /timeline/...)
  description = description.replace(/^\[\d+\]:\s*.+$/gm, '').trim();

  // Clean up multiple consecutive newlines left by removing link references
  description = description.replace(/\n{3,}/g, '\n\n').trim();

  // Extract inline citations and build footnote metadata
  const inlineCitations = new Map(); // number -> { source, date, pageRange }

  // First, find all citation blocks (both single and grouped)
  const citationBlocks = description.matchAll(/\[\[((?:(?!\[\[)[\s\S])*?)\]\]/g);

  for (const blockMatch of citationBlocks) {
    let blockContent = blockMatch[1];

    // Split by semicolon to handle multiple citations in one block
    const individualCitations = blockContent.split(';');

    for (const citation of individualCitations) {
      // For the first citation in a grouped block, the opening [ was consumed by [[
      let citationText = citation.trim();
      if (!citationText.startsWith('[')) {
        citationText = '[' + citationText;
      }

      // Extract [Source, Date][N] pattern from each citation
      const citationPattern = /\[([^\]]+)\]\[(\d+)/g;
      let match;

      while ((match = citationPattern.exec(citationText)) !== null) {
        let sourceDate = match[1].trim();
        const num = parseInt(match[2], 10);

        // Clean up any leftover brackets from the source
        sourceDate = sourceDate.replace(/^\[+/, '').replace(/\]+$/, '');

        // Parse source, date, and page range
        const parts = sourceDate.split(',').map(p => p.trim());
        let source = (parts[0] || 'Unknown').trim();

        // Clean up any remaining brackets from source
        source = source.replace(/^\[+/, '').replace(/\]+$/, '');

        let date = '';
        let pageRange = undefined;

        // Look for page range pattern in remaining parts
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          if (part.match(/^pp?\.\s*[\d\-,\s]+$/i)) {
            // This is a page range (pp. 1-10, p. 5, pp. 1-4, 6, etc.)
            pageRange = part;
          } else {
            // This is the date
            date = part;
          }
        }

        inlineCitations.set(num, { source, date, pageRange });
      }
    }
  }

  // Replace inline citations with just [N] markers
  description = description.replace(/\[\[((?:(?!\[\[)[\s\S])*?)\]\]/g, (match, content) => {
    // Extract all [N] numbers from the citation block
    const numbers = [];
    const numberPattern = /\]\[(\d+)/g;
    let numMatch;

    while ((numMatch = numberPattern.exec(content)) !== null) {
      numbers.push(`[${numMatch[1]}]`);
    }

    return numbers.join(' ');
  });

  // Helper function to clean brackets
  const cleanBrackets = (str) => {
    return str.replace(/^\[+/, '').replace(/\]+$/, '').replace(/\[+/g, '').replace(/\]+/g, '').trim();
  };

  // Helper to extract source name from URL
  const getSourceFromUrl = (url, num) => {
    try {
      const urlObj = new URL(url);
      let hostname = urlObj.hostname.replace(/^www\./, '');
      const domainParts = hostname.split('.');
      let sourceName = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);

      // Handle special cases
      if (hostname.includes('historycommons.org')) return 'History Commons';
      if (hostname.includes('archive.org')) return 'Archive.org';
      if (hostname.includes('nist.gov')) return 'NIST';
      if (hostname.includes('fema.gov')) return 'FEMA';
      if (hostname.includes('cnn.com')) return 'CNN';
      if (hostname.includes('usatoday')) return 'USA Today';
      if (hostname.includes('nytimes.com')) return 'New York Times';

      return sourceName;
    } catch {
      return `Reference ${num}`;
    }
  };

  // Build links array
  const links = [];
  for (const [num, url] of linkReferences) {
    const citation = inlineCitations.get(num);
    let title;

    if (citation) {
      title = `${citation.source} - ${citation.date}`;
    } else {
      // Extract from URL
      title = getSourceFromUrl(url, num);
    }

    // Clean any brackets from title
    title = cleanBrackets(title);

    links.push({ title, url });
  }

  // Build footnotes array
  const footnotes = [];
  for (const [num, url] of linkReferences) {
    const citation = inlineCitations.get(num);

    let referenceName;
    let customSource;
    let date;
    let pageRange;

    if (citation) {
      // We have citation data from inline reference
      referenceName = `${citation.source} - ${citation.date}`;
      customSource = citation.source;
      date = citation.date;
      pageRange = citation.pageRange;
    } else {
      // No citation data, extract source from URL
      const sourceName = getSourceFromUrl(url, num);
      referenceName = sourceName;
      customSource = sourceName;
      date = '';
    }

    // Clean any brackets
    referenceName = cleanBrackets(referenceName);
    customSource = cleanBrackets(customSource);

    const footnote = {
      number: num,
      type: 'link',
      referenceName,
      customSource,
      date
    };

    if (pageRange) {
      footnote.pageRange = pageRange;
    }

    footnotes.push(footnote);
  }

  return {
    title: eventTitle,
    time: eventTime,
    description,
    links,
    footnotes,
  };
}

async function updateEvent(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\nProcessing ${fileName}...`);

  try {
    // Read and parse the markdown file
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseHistoryCommonsMarkdown(content);

    console.log(`  Title: ${parsed.title}`);
    console.log(`  Description length: ${parsed.description.length} characters`);
    console.log(`  Links count: ${parsed.links.length}`);
    console.log(`  Footnotes count: ${parsed.footnotes.length}`);

    // Find the event in the database by title
    const event = await Event.findOne({ title: parsed.title });

    if (!event) {
      console.log(`  ✗ Event not found in database`);
      return { file: fileName, status: 'not_found' };
    }

    console.log(`  Found event: ${event._id}`);
    console.log(`  Current description length: ${event.description?.length || 0} characters`);
    console.log(`  Current footnotes count: ${event.footnotes?.length || 0}`);

    // Deduplicate links by URL (same source might be cited multiple times)
    const uniqueLinks = [];
    const seenUrls = new Set();
    for (const linkData of parsed.links) {
      if (!seenUrls.has(linkData.url)) {
        seenUrls.add(linkData.url);
        uniqueLinks.push(linkData);
      }
    }

    console.log(`  Deduplicated ${parsed.links.length} links to ${uniqueLinks.length} unique URLs`);

    // Create or find links and build linkMap (by both title AND URL)
    const linkMap = new Map(); // title -> id
    const urlToLinkId = new Map(); // url -> id (for deduplication)

    for (const linkData of uniqueLinks) {
      try {
        // First check if we already have a Link with this URL in the database
        let existingLink = await Link.findOne({ url: linkData.url });

        let linkId;
        if (existingLink) {
          linkId = existingLink._id;
          console.log(`    Reusing existing link: ${linkData.title}`);

          // Check if LinkLink association exists for this event
          const existingLinkLink = await LinkLink.findOne({
            linkId: existingLink._id,
            eventId: event._id
          });

          if (!existingLinkLink) {
            // Create LinkLink association
            await LinkLink.create({
              linkId: existingLink._id,
              eventId: event._id,
              createdBy: event.createdBy,
            });
            console.log(`    Created LinkLink association for existing link`);
          }
        } else {
          // Create new link
          const link = await Link.create({
            title: linkData.title,
            url: linkData.url,
            createdBy: event.createdBy,
          });
          linkId = link._id;

          // Create LinkLink association
          await LinkLink.create({
            linkId: link._id,
            eventId: event._id,
            createdBy: event.createdBy,
          });

          console.log(`    Created new link: ${linkData.title}`);
        }

        urlToLinkId.set(linkData.url, linkId);
      } catch (error) {
        console.error(`    ✗ Error creating link ${linkData.title}:`, error.message);
      }
    }

    // Build linkMap using urlToLinkId for all original links (including duplicates)
    // This ensures all footnotes can find their link IDs even if the link was deduplicated
    for (const linkData of parsed.links) {
      const linkId = urlToLinkId.get(linkData.url);
      if (linkId) {
        linkMap.set(linkData.title, linkId);
      }
    }

    // Build mapped footnotes with Link IDs
    const mappedFootnotes = [];
    for (const fn of parsed.footnotes) {
      const linkId = linkMap.get(fn.referenceName);

      if (linkId) {
        const footnote = {
          number: fn.number,
          type: 'link',
          referenceId: linkId,
          customSource: fn.customSource,
          date: fn.date || '',
        };

        if (fn.pageRange) {
          footnote.pageRange = fn.pageRange;
        }

        mappedFootnotes.push(footnote);
      } else {
        console.warn(`    ⚠ Could not find link ID for footnote: ${fn.referenceName}`);
      }
    }

    console.log(`  Mapped ${mappedFootnotes.length} footnotes to Link IDs`);

    // Update the event with new description, footnotes, and startDateTime
    event.description = parsed.description;
    event.footnotes = mappedFootnotes;
    if (parsed.time) {
      // Parse time as EDT (UTC-4) for 9/11 events in September
      // The markdown times are in Eastern time, so we need to append the timezone offset
      let timeStr = parsed.time;
      if (!timeStr.includes('Z') && !timeStr.includes('+') && !timeStr.includes('-', 10)) {
        // No timezone specified, assume EDT (UTC-4) for September 2001
        timeStr = timeStr + '-04:00';
      }
      event.startDateTime = new Date(timeStr);
      console.log(`  Updated startDateTime to: ${event.startDateTime.toISOString()}`);
    }
    await event.save();

    console.log(`  ✓ Updated event successfully`);
    console.log(`  New description length: ${event.description.length} characters`);
    console.log(`  New footnotes count: ${event.footnotes.length}`);

    return {
      file: fileName,
      status: 'updated',
      eventId: event._id,
      oldDescLength: event.description?.length || 0,
      newDescLength: parsed.description.length,
      newFootnotesCount: mappedFootnotes.length
    };
  } catch (error) {
    console.error(`  ✗ Error:`, error.message);
    return { file: fileName, status: 'error', error: error.message };
  }
}

async function batchUpdate(directory) {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://timeliner:renilemit@45.61.62.91:27017/lucidio?authSource=admin';

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const files = fs.readdirSync(directory).filter(f => f.endsWith('.md'));
    console.log(`\nFound ${files.length} markdown files in ${directory}`);

    if (files.length === 0) {
      console.log('No files to process');
      return;
    }

    const results = {
      updated: 0,
      skipped: 0,
      notFound: 0,
      errors: 0,
    };

    for (const file of files) {
      const fullPath = path.join(directory, file);
      const result = await updateEvent(fullPath);

      if (result.status === 'updated') results.updated++;
      else if (result.status === 'skipped') results.skipped++;
      else if (result.status === 'not_found') results.notFound++;
      else if (result.status === 'error') results.errors++;
    }

    console.log('\n=== BATCH UPDATE SUMMARY ===');
    console.log(`Total files processed: ${files.length}`);
    console.log(`Updated: ${results.updated}`);
    console.log(`Skipped (already up to date): ${results.skipped}`);
    console.log(`Not found: ${results.notFound}`);
    console.log(`Errors: ${results.errors}`);

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  } catch (error) {
    console.error('Batch update error:', error);
    process.exit(1);
  }
}

// Command line usage
const directory = process.argv[2] || '../timeline-of-terror/timelines/upped';
console.log('=== BATCH UPDATE SCRIPT ===');
console.log(`Directory: ${directory}\n`);

batchUpdate(directory)
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
