import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Ollama } from 'ollama';
import dbConnect from '@/lib/mongodb';
import ParsingPerformance from '@/models/ParsingPerformance';

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
  fetch: (url, options) => {
    return fetch(url, {
      ...options,
      // Increase timeout to 5 minutes for batch processing
      signal: AbortSignal.timeout(300000)
    });
  }
});

async function extractTextFromFile(file: File): Promise<string> {
  try {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    // Handle text files
    if (fileType === 'text/plain' || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      const text = await file.text();
      return text.substring(0, 50000); // Increased limit to handle longer articles with many citations
    }

    // Handle JSON files
    if (fileType === 'application/json' || fileName.endsWith('.json')) {
      const text = await file.text();
      return text.substring(0, 50000);
    }

    // Handle CSV files
    if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
      const text = await file.text();
      return text.substring(0, 50000);
    }

    // For other file types, try to read as text
    try {
      const text = await file.text();
      return text.substring(0, 50000);
    } catch {
      throw new Error(`Unsupported file type: ${fileType || 'unknown'}. Supported: txt, md, json, csv`);
    }
  } catch (error) {
    throw new Error(`Failed to extract text from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

interface ParsedHistoryCommonsData {
  event: {
    title: string;
    description: string;
    startDateTime: string;
    importance: number;
    location?: string;
    chains: string[];
  };
  rawTimeStr: string | null;
  links: Array<{ title: string; url: string }>;
  footnotes: Array<{
    number: number;
    type: string;
    referenceName: string;
    customSource: string;
    date: string;
    pageRange?: string;
  }>;
  chains: Array<{ name: string; description: string }>;
  attachments: Array<{
    url: string;
    originalName: string;
    type: 'photo' | 'document' | 'other';
    metadata: {
      alt?: string;
      caption?: string;
      source?: string;
    };
  }>;
}

function parseHistoryCommonsMarkdown(content: string): ParsedHistoryCommonsData {
  // Extract YAML frontmatter
  const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const yamlContent = yamlMatch ? yamlMatch[1] : '';

  // Parse YAML fields
  const idMatch = yamlContent.match(/^id:\s*(.+)$/m);
  const titleMatch = yamlContent.match(/^title:\s*(.+)$/m);
  const timeMatch = yamlContent.match(/^time:\s*(.+)$/m);
  const timelinesMatch = yamlContent.match(/^timelines:\s*\n((?:  - .+\n?)+)/m);

  const eventId = idMatch ? idMatch[1].trim() : '';
  const eventTitle = titleMatch ? titleMatch[1].trim() : 'Untitled Event';

  // Store raw time string - will be parsed with timezone context later
  let rawTimeStr: string | null = null;
  if (timeMatch) {
    rawTimeStr = timeMatch[1].trim();
  }

  // Placeholder time - will be replaced after timezone interpretation
  let eventTime = new Date().toISOString();

  // Extract timeline chains
  const chainNames: string[] = [];
  if (timelinesMatch) {
    const timelinesText = timelinesMatch[1];
    const chainMatches = timelinesText.matchAll(/^  - (.+)$/gm);
    for (const match of chainMatches) {
      chainNames.push(match[1].trim());
    }
  }

  // Extract main content (everything after YAML frontmatter)
  const contentAfterYaml = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');

  // Extract attachments from <figure> tags before removing them
  const attachments: Array<{
    url: string;
    originalName: string;
    type: 'photo' | 'document' | 'other';
    metadata: {
      alt?: string;
      caption?: string;
      source?: string;
    };
  }> = [];

  const figureMatches = contentAfterYaml.matchAll(/<figure[^>]*>([\s\S]*?)<\/figure>/gi);
  for (const figureMatch of figureMatches) {
    const figureContent = figureMatch[1];

    // Extract img tag
    const imgMatch = figureContent.match(/<img[^>]*>/i);
    if (imgMatch) {
      const imgTag = imgMatch[0];

      // Extract src
      const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
      let url = srcMatch ? srcMatch[1] : '';

      if (url) {
        // Fix protocol-relative URLs (//example.com/image.jpg)
        if (url.startsWith('//')) {
          url = 'https:' + url;
        }

        // Extract alt text
        const altMatch = imgTag.match(/alt=["']([^"']+)["']/i);
        const alt = altMatch ? altMatch[1] : '';

        // Extract caption from figcaption
        const captionMatch = figureContent.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);
        const caption = captionMatch ? captionMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        // Get filename from URL
        const urlParts = url.split('/');
        const originalName = urlParts[urlParts.length - 1] || 'image';

        attachments.push({
          url,
          originalName,
          type: 'photo',
          metadata: {
            alt: alt || undefined,
            caption: caption || undefined,
          }
        });
      }
    }
  }

  // Remove HTML tags from description (but keep the text content)
  let description = contentAfterYaml
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();

  // Convert **text** to <strong>text</strong> for bold formatting
  description = description.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Extract all link references from bottom: [N]: URL
  const linkReferences = new Map<number, string>();
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

  // Extract inline citations and build footnotes: [[Source, Date][N]] or grouped [[Source1, Date1][N1]; [Source2, Date2][N2]; ...]
  const inlineCitations = new Map<number, { source: string; date: string; pageRange?: string }>();

  // First, find all citation blocks (both single and grouped)
  // Use negative lookahead to match everything inside [[ ]] without matching nested [[
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
      const citationPattern = /\[([^\]]+)\]\[(\d+)\]/g;
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
        let pageRange: string | undefined = undefined;

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
  // Handle grouped citations: [[Source1, Date1][1]; [Source2, Date2][2]] -> [1] [2]
  // Use negative lookahead to match everything inside [[ ]] without matching nested [[
  description = description.replace(/\[\[((?:(?!\[\[)[\s\S])*?)\]\]/g, (match, content) => {
    // Extract all [N] numbers from the citation block
    // Note: content doesn't include the final ], so match ][N without requiring the closing ]
    const numbers: string[] = [];
    const numberPattern = /\]\[(\d+)/g;
    let numMatch;

    while ((numMatch = numberPattern.exec(content)) !== null) {
      numbers.push(`[${numMatch[1]}]`);
    }

    return numbers.join(' ');
  });

  // Helper function to aggressively clean brackets
  const cleanBrackets = (str: string): string => {
    return str.replace(/^\[+/, '').replace(/\]+$/, '').replace(/\[+/g, '').replace(/\]+/g, '').trim();
  };

  // Get the set of valid link numbers (ones that have actual http(s) URLs)
  const validLinkNumbers = new Set(linkReferences.keys());

  // Remove any [N] references in description that don't have valid links
  description = description.replace(/\[(\d+)\]/g, (match, num) => {
    const numInt = parseInt(num, 10);
    return validLinkNumbers.has(numInt) ? match : '';
  });

  // Also remove any remaining citation-style patterns like [Text][N] where N is invalid
  description = description.replace(/\[[^\]]+\]\[(\d+)\]/g, (match, num) => {
    const numInt = parseInt(num, 10);
    return validLinkNumbers.has(numInt) ? `[${num}]` : '';
  });

  // Helper to extract source name from URL
  const getSourceFromUrl = (url: string, num: number): string => {
    try {
      const urlObj = new URL(url);
      let hostname = urlObj.hostname.replace(/^www\./, '');
      const domainParts = hostname.split('.');
      let sourceName = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);

      // Handle special cases (news orgs, government sites, etc.)
      if (hostname.includes('historycommons.org')) return 'History Commons';
      if (hostname.includes('archive.org')) return 'Archive.org';
      if (hostname.includes('nist.gov')) return 'NIST';
      if (hostname.includes('fema.gov')) return 'FEMA';
      if (hostname.includes('cnn.com')) return 'CNN';
      if (hostname.includes('usatoday')) return 'USA Today';
      if (hostname.includes('nytimes.com')) return 'New York Times';
      if (hostname.includes('newsday.com')) return 'Newsday';
      if (hostname.includes('norad.mil')) return 'NORAD';

      return sourceName;
    } catch {
      return `Reference ${num}`;
    }
  };

  // Build links array
  const links: Array<{ title: string; url: string }> = [];
  for (const [num, url] of linkReferences) {
    const citation = inlineCitations.get(num);
    let title: string;

    if (citation) {
      title = `${citation.source} - ${citation.date}`;
    } else {
      // Extract from URL
      title = getSourceFromUrl(url, num);
    }

    // Aggressively clean any brackets from title
    title = cleanBrackets(title);

    links.push({ title, url });
  }

  // Build footnotes array - create a footnote for EVERY link reference
  const footnotes: Array<{
    number: number;
    type: string;
    referenceName: string;
    customSource: string;
    date: string;
    pageRange?: string;
  }> = [];

  for (const [num, url] of linkReferences) {
    const citation = inlineCitations.get(num);

    let referenceName: string;
    let customSource: string;
    let date: string;
    let pageRange: string | undefined;

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

    // Aggressively clean any brackets
    referenceName = cleanBrackets(referenceName);
    customSource = cleanBrackets(customSource);

    const footnote: any = {
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

  // Build chains array
  const chains = chainNames.map(name => ({
    name,
    description: `${name} timeline`
  }));

  return {
    event: {
      title: eventTitle,
      description,
      startDateTime: eventTime,
      importance: 5,
      location: undefined,
      chains: chainNames
    },
    rawTimeStr,
    links,
    footnotes,
    chains,
    attachments
  };
}

// Geocode a place name to coordinates using Nominatim (OpenStreetMap)
async function geocodePlace(placeName: string): Promise<{ lat: number; lon: number; timezone?: string } | null> {
  try {
    const encodedPlace = encodeURIComponent(placeName);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodedPlace}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'Timeliner/1.0 (history timeline application)',
        },
      }
    );

    if (!response.ok) {
      console.error('Nominatim API error:', response.status);
      return null;
    }

    const results = await response.json();
    if (results.length > 0) {
      const result = results[0];
      const coords = {
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
      };

      // Get timezone for these coordinates
      const timezone = await getTimezoneForCoordinates(coords.lat, coords.lon);

      return {
        ...coords,
        timezone: timezone || undefined,
      };
    }

    console.log(`No geocoding results for: ${placeName}`);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// Get timezone from coordinates using timeapi.io (free, no API key)
async function getTimezoneForCoordinates(lat: number, lon: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lon}`,
      {
        headers: {
          'User-Agent': 'Timeliner/1.0 (history timeline application)',
        },
      }
    );

    if (!response.ok) {
      console.error('Timezone API error:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.timeZone) {
      console.log(`Timezone for (${lat}, ${lon}):`, data.timeZone);
      return data.timeZone;
    }

    return null;
  } catch (error) {
    console.error('Timezone lookup error:', error);
    return null;
  }
}

// Parse time string with timezone context using Intl API
async function parseTimeWithTimezone(timeStr: string, timezone: string | undefined, lat?: number, lon?: number): Promise<string> {
  console.log(`[parseTimeWithTimezone] Input: "${timeStr}", timezone: ${timezone}`);

  try {
    // If we have a timezone, parse as local time in that timezone
    if (timezone) {
      // Check if time string already has timezone info
      if (timeStr.includes('Z') || timeStr.match(/[+-]\d{2}:\d{2}$/)) {
        console.log('[parseTimeWithTimezone] Time string already has timezone info, parsing as-is');
        const date = new Date(timeStr);
        if (!isNaN(date.getTime())) {
          const result = date.toISOString();
          console.log(`[parseTimeWithTimezone] Result: ${result}`);
          return result;
        }
      }

      // Parse the date components
      const dateParts = timeStr.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/);
      console.log('[parseTimeWithTimezone] Date parts:', dateParts);

      if (dateParts) {
        const [, year, month, day, hour, minute, second = '0'] = dateParts;

        // Use a more reliable approach: Format the date in the target timezone, then convert to UTC
        // Create the local date string in ISO format
        const localDateString = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
        console.log(`[parseTimeWithTimezone] Local time string: ${localDateString} (${timezone})`);

        try {
          // Parse as if it's a UTC date, then get the local time parts
          const parts = {
            year: parseInt(year),
            month: parseInt(month),
            day: parseInt(day),
            hour: parseInt(hour),
            minute: parseInt(minute),
            second: parseInt(second)
          };

          // Create a formatter for the target timezone
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZoneName: 'short'
          });

          // We need to find the UTC time that corresponds to this local time
          // Start with a guess (interpret as UTC)
          let guessUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

          // Format this UTC time in the target timezone
          let guessLocal = new Date(guessUtc);
          let formattedParts = formatter.formatToParts(guessLocal);

          // Extract the formatted time components
          const getPartValue = (type: string) => formattedParts.find(p => p.type === type)?.value || '0';

          let localYear = parseInt(getPartValue('year'));
          let localMonth = parseInt(getPartValue('month'));
          let localDay = parseInt(getPartValue('day'));
          let localHour = parseInt(getPartValue('hour'));
          let localMinute = parseInt(getPartValue('minute'));
          let localSecond = parseInt(getPartValue('second'));

          // Calculate the difference and adjust
          const yearDiff = parts.year - localYear;
          const monthDiff = parts.month - localMonth;
          const dayDiff = parts.day - localDay;
          const hourDiff = parts.hour - localHour;
          const minuteDiff = parts.minute - localMinute;
          const secondDiff = parts.second - localSecond;

          // Apply the difference to get the correct UTC time
          guessUtc = Date.UTC(
            parts.year + yearDiff,
            (parts.month - 1) + monthDiff,
            parts.day + dayDiff,
            parts.hour + hourDiff,
            parts.minute + minuteDiff,
            parts.second + secondDiff
          );

          const result = new Date(guessUtc).toISOString();
          console.log(`[parseTimeWithTimezone] Converted ${localDateString} (${timezone}) → ${result} (UTC)`);
          return result;

        } catch (intlError) {
          console.error('[parseTimeWithTimezone] Intl conversion error:', intlError);

          // Fallback: Interpret as UTC
          console.log('[parseTimeWithTimezone] FALLBACK: Using UTC interpretation');
          const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
          if (!isNaN(date.getTime())) {
            const result = date.toISOString();
            console.warn(`Parsed time ${timeStr} as ${result} - Timezone conversion failed for ${timezone}`);
            return result;
          }
        }
      } else {
        console.error('[parseTimeWithTimezone] Date parts did not match regex');
      }
    } else {
      console.error('[parseTimeWithTimezone] No timezone provided');
    }

    // Fallback: parse without timezone context
    console.log('[parseTimeWithTimezone] FALLBACK: Parsing without timezone context');
    const date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
      const result = date.toISOString();
      console.log(`[parseTimeWithTimezone] Fallback no-timezone result: ${result}`);
      return result;
    }

    // Last resort: return current time
    console.warn(`Could not parse time: "${timeStr}", using current time`);
    return new Date().toISOString();
  } catch (error) {
    console.error('Time parsing error:', error);
    return new Date().toISOString();
  }
}

async function extractEntitiesAndConnections(
  eventTitle: string,
  eventDescription: string,
  model: string = process.env.OLLAMA_MODEL || 'qwen2.5:7b'
): Promise<{
  entities: Array<any>;
  connections: Array<any>;
  location: { name: string; lat: number; lon: number; timezone?: string } | null;
}> {
  const prompt = `Analyze the following event and extract entities, relationships, and the event location.

CRITICAL RULES - ENTITIES AND CONNECTIONS:
1. ONLY create entities that have explicit connections to the event or other entities
2. For EVERY entity you create, you MUST also create at least one connection in the "connections" array
3. An entity without a connection is INVALID and must be discarded
4. Validate each entity: if you cannot identify a relationship for it, DO NOT include it in the output

LOCATION EXTRACTION:
5. Extract the primary location where this event occurred
6. Provide ONLY the place name - coordinates will be looked up automatically
7. Be as specific as possible (e.g., "Portland International Jetport, Portland, Maine" not just "Portland")
8. If no clear location is found, set location to null

Event Title: ${eventTitle}

Event Description:
${eventDescription}

Please return a JSON object with the following structure:
{
  "location": "string - specific place name (e.g., 'Portland International Jetport, Portland, Maine')" or null,
  "entities": [
    {
      "name": "string - entity name",
      "type": "person|place|organization|object|other" - MUST be exactly one of these 5 values, NEVER use "event" as a type,
      "description": "string - brief description",
      "importance": 1-5,
      "metadata": {
        "category": "string - specific category (e.g., hijacker, building, aircraft, investigation)",
        "aliases": ["array of alternative names"]
      }
    }
  ],
  "connections": [
    {
      "sourceType": "event|entity",
      "sourceName": "string - name/title of source (use exact event title: '${eventTitle}' for the event)",
      "targetType": "event|entity",
      "targetName": "string - name/title of target",
      "relationshipType": "perpetrator_of|hijacker_of|victim_of|died_in|location_of|occurred_at|collided_with|damaged|investigated|investigated_by|reported_by|aboard|part_of_chain|involved_in",
      "context": "string - brief excerpt showing this relationship",
      "confidence": "explicit|inferred"
    }
  ]
}

VALIDATION REQUIREMENTS:
- The "connections" array is MANDATORY and must contain at least one connection for EVERY entity in the "entities" array
- Before finalizing your response, verify that each entity name appears in at least one connection (either as sourceName or targetName)
- If an entity has no connections, REMOVE it from the entities array - orphaned entities are not allowed
- Use "${eventTitle}" exactly when referring to the event in connections
- CRITICAL: Entity type MUST be one of: person, place, organization, object, other. NEVER use "event" as an entity type
- Validate each entity before including it: type must be valid, name must be non-empty, description should be meaningful

RELATIONSHIP TYPES GUIDE:
- perpetrator_of: Person who committed an attack → Event
- hijacker_of: Person who hijacked → Aircraft/vehicle
- victim_of: Person who died/was harmed → Event
- died_in: Person who died → Event
- occurred_at: Event → Location where it happened
- location_of: Location → Event (reverse of occurred_at)
- collided_with: Object that hit → Object/place that was hit
- damaged: Object that caused damage → Object/place damaged
- investigated: Organization conducting investigation → Event/entity
- investigated_by: Event/entity → Organization (reverse of investigated)
- reported_by: Event → Organization that reported it
- aboard: Person → Vehicle/aircraft they were on
- involved_in: Entity → Event (general participation)

CRITICAL: Return ONLY the JSON object, with no additional text, explanations, or markdown formatting.
Do not wrap the JSON in markdown code blocks. Output raw JSON only.`;

  try {
    const response = await ollama.chat({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      format: 'json',
    });

    const llmResponse = response.message.content;

    // Parse JSON response
    let cleanedResponse = llmResponse.trim();
    cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // Geocode the location if we have a place name
      let locationWithCoords: { name: string; lat: number; lon: number; timezone?: string } | null = null;

      if (parsed.location && typeof parsed.location === 'string') {
        console.log('Geocoding location:', parsed.location);
        const coords = await geocodePlace(parsed.location);

        if (coords) {
          locationWithCoords = {
            name: parsed.location,
            lat: coords.lat,
            lon: coords.lon,
            timezone: coords.timezone,
          };
          console.log('Geocoded successfully:', locationWithCoords);
        } else {
          console.warn('Failed to geocode location:', parsed.location);
          // Still include the location but without coordinates
          // Frontend can handle missing coords gracefully
          locationWithCoords = {
            name: parsed.location,
            lat: 0,
            lon: 0,
          };
        }
      }

      return {
        entities: parsed.entities || [],
        connections: parsed.connections || [],
        location: locationWithCoords
      };
    }

    return { entities: [], connections: [], location: null };
  } catch (error) {
    console.error('Entity extraction error:', error);
    // Return empty arrays if Ollama fails - static parsing already succeeded
    return { entities: [], connections: [], location: null };
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now(); // Track performance
  let tokenCount = 0;
  let success = false;
  let userId: string | undefined;

  try {
    // Check for API key authentication first
    const authHeader = request.headers.get('Authorization');

    if (authHeader?.startsWith('Bearer ')) {
      // API key authentication for batch uploads
      const apiKeyResponse = await fetch('http://localhost:3000/api/batch-upload', {
        method: 'POST',
        headers: { 'Authorization': authHeader }
      });

      if (!apiKeyResponse.ok) {
        return NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401 });
      }

      const userData = await apiKeyResponse.json();
      userId = userData.userId;
    } else {
      // Session authentication for UI uploads
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = session.user.id;
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    console.log('Parse file request:', { fileName: file?.name, fileType: file?.type });

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // Extract text content from file
    let textContent: string;
    try {
      textContent = await extractTextFromFile(file);
      console.log('Extracted text content length:', textContent.length);

      // Estimate token count (~4 characters per token on average)
      tokenCount = Math.floor(textContent.length / 4);
    } catch (error) {
      return NextResponse.json({
        error: `Failed to extract text from file: ${error instanceof Error ? error.message : 'Unknown error'}`
      }, { status: 400 });
    }

    // Parse History Commons markdown format
    try {
      const parsed = parseHistoryCommonsMarkdown(textContent);

      console.log('Static parser results:', {
        title: parsed.event.title,
        descriptionLength: parsed.event.description.length,
        linksCount: parsed.links.length,
        footnotesCount: parsed.footnotes.length,
        chainsCount: parsed.chains.length,
        attachmentsCount: parsed.attachments.length
      });

      // Log first few items for debugging
      console.log('First 3 links:', parsed.links.slice(0, 3));
      console.log('First 3 footnotes:', parsed.footnotes.slice(0, 3));
      console.log('First 3 attachments:', parsed.attachments.slice(0, 3));
      console.log('Description preview (first 500 chars):', parsed.event.description.substring(0, 500));

      // Extract entities and connections using Ollama
      console.log('Starting entity extraction with Ollama...');
      const { entities, connections, location } = await extractEntitiesAndConnections(
        parsed.event.title,
        parsed.event.description
      );
      console.log('Entity extraction complete:', {
        entitiesCount: entities.length,
        connectionsCount: connections.length,
        location: location ? location.name : 'None'
      });

      // Parse event time with timezone context
      // If location found, use its timezone; otherwise default to America/New_York (EST/EDT)
      console.log('=== TIME PARSING DEBUG ===');
      console.log('rawTimeStr:', parsed.rawTimeStr);
      console.log('location:', location);

      if (parsed.rawTimeStr) {
        const timezone = location?.timezone || 'America/New_York';
        const lat = location?.lat;
        const lon = location?.lon;

        console.log(`Parsing event time with timezone: ${timezone}`);
        console.log(`Raw time string: "${parsed.rawTimeStr}"`);
        const correctedTime = await parseTimeWithTimezone(parsed.rawTimeStr, timezone, lat, lon);
        console.log(`Corrected time result: ${correctedTime}`);
        parsed.event.startDateTime = correctedTime;
        console.log(`Time interpreted: ${parsed.rawTimeStr} (${timezone}) → ${correctedTime} (UTC)`);
      } else {
        console.log('WARNING: No rawTimeStr found, using placeholder time');
      }

      // Update event with extracted location if found
      if (location) {
        parsed.event.location = location.name;
      }

      // Mark as successful
      success = true;

      // Store performance data
      const durationMs = Date.now() - startTime;
      try {
        await dbConnect();
        await ParsingPerformance.create({
          userId: userId,
          parsingType: 'file',
          tokenCount,
          durationMs,
          tokensPerSecond: (tokenCount / durationMs) * 1000,
          model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
          success: true,
        });
        console.log(`Performance recorded: ${tokenCount} tokens in ${durationMs}ms`);
      } catch (perfError) {
        console.error('Failed to record performance:', perfError);
        // Don't fail the request if performance tracking fails
      }

      // Return parsed data in the expected format
      return NextResponse.json({
        fileName: file.name,
        parsed: {
          events: [parsed.event],
          entities,
          connections,
          chains: parsed.chains,
          attachments: parsed.attachments,
          links: parsed.links,
          footnotes: parsed.footnotes,
          locations: location ? [{
            name: location.name,
            lat: location.lat,
            lon: location.lon,
            description: `Location of ${parsed.event.title}`
          }] : []
        },
        rawContent: textContent.substring(0, 500) + '...'
      });
    } catch (parseError) {
      console.error('Parse error:', parseError);

      // Record failed parsing
      const durationMs = Date.now() - startTime;
      try {
        await dbConnect();
        await ParsingPerformance.create({
          userId: userId,
          parsingType: 'file',
          tokenCount,
          durationMs,
          tokensPerSecond: tokenCount > 0 ? (tokenCount / durationMs) * 1000 : 0,
          model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
          success: false,
          errorMessage: parseError instanceof Error ? parseError.message : 'Unknown error',
        });
      } catch (perfError) {
        console.error('Failed to record performance:', perfError);
      }

      return NextResponse.json({
        error: 'Failed to parse History Commons markdown format',
        details: parseError instanceof Error ? parseError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Parse file API error:', error);

    // Record failed parsing
    const durationMs = Date.now() - startTime;
    if (userId) {
      try {
        await dbConnect();
        await ParsingPerformance.create({
          userId: userId,
          parsingType: 'file',
          tokenCount,
          durationMs,
          tokensPerSecond: tokenCount > 0 ? (tokenCount / durationMs) * 1000 : 0,
          model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Internal server error',
        });
      } catch (perfError) {
        console.error('Failed to record performance:', perfError);
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
