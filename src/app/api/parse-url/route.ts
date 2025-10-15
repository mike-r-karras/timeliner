import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Ollama } from 'ollama';

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434'
});

async function fetchWebContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Extract basic text content (simple HTML stripping)
    const textContent = html
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 4000); // Limit content size

    return textContent;
  } catch (error) {
    throw new Error(`Failed to fetch content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url, model = process.env.OLLAMA_MODEL || 'qwen2.5:7b' } = await request.json();
    console.log('Parse URL request:', { url, model });

    if (!url?.trim()) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Fetch web content
    let webContent: string;
    try {
      webContent = await fetchWebContent(url);
    } catch (error) {
      return NextResponse.json({
        error: `Failed to fetch web content: ${error instanceof Error ? error.message : 'Unknown error'}`
      }, { status: 400 });
    }

    // Create LLM prompt for parsing entity data
    const prompt = `Analyze the following web page content and extract comprehensive structured data for timeline events with entities, relationships, and references.

CRITICAL RULES - ENTITIES AND CONNECTIONS:
1. ONLY create entities that have explicit connections to events or other entities
2. For EVERY entity you create, you MUST also create at least one connection in the "connections" array
3. An entity without a connection is INVALID and must be discarded
4. Validate each entity: if you cannot identify a relationship for it, DO NOT include it in the output

OTHER RULES:
5. Extract all images with their metadata (alt text, captions, source URLs)
6. Parse inline citations and convert to footnotes (see INLINE CITATION FORMAT below)
7. Identify event chains (categories/themes that group related events)

INLINE CITATION FORMAT:
The content may contain inline citations in this format: [[Source, Date][N]]
- Example: "The plane crashed [[CNN, 9/12/2001][1]] into the building [[NIST, 5/1/2002][4]]"
- At the end of the content, there will be link references like:
  [1]: http://www.cnn.com/2001/US/09/11/chronology.attack/
  [4]: https://www.fema.gov/media-library/assets/documents/3544

IMPORTANT:
- Replace inline citations [[Source, Date][N]] with ONLY [N] in the event description
  * REMOVE the entire [[Source, Date][N]] pattern
  * KEEP only the [N] number reference
  * DO NOT leave any part of the source or date in the description
- Extract the Source and Date from the inline citation before removing it
- Match [N] to the corresponding [N]: URL link at the bottom
- Create a footnote with the extracted source and date

Example transformations:

SIMPLE CITATION:
INPUT: "The plane crashed [[CNN, 9/12/2001][1]] into the building"
LINK AT BOTTOM: [1]: http://www.cnn.com/2001/US/09/11/chronology.attack/
OUTPUT description: "The plane crashed [1] into the building"
OUTPUT footnote: { number: 1, type: "link", referenceName: "CNN - 9/12/2001", customSource: "CNN", date: "9/12/2001" }
OUTPUT link: { title: "CNN - 9/12/2001", url: "http://www.cnn.com/2001/US/09/11/chronology.attack/" }

MULTIPLE CITATIONS:
INPUT: "Seismic records pinpoint the crash at 26 seconds after 8:46 a.m. [[CNN, 9/12/2001][1]; [NORAD, 9/18/2001][2]; [USA Today, 12/20/2001][3]]"
LINKS AT BOTTOM:
[1]: http://www.cnn.com/2001/US/09/11/chronology.attack/
[2]: https://web.archive.org/web/20030809155434/http:/www.norad.mil/
[3]: https://usatoday30.usatoday.com/news/sept11/2001/12/19/usatcov-wtcsurvival.htm
OUTPUT description: "Seismic records pinpoint the crash at 26 seconds after 8:46 a.m. [1] [2] [3]"
OUTPUT footnotes: [
  { number: 1, type: "link", referenceName: "CNN - 9/12/2001", customSource: "CNN", date: "9/12/2001" },
  { number: 2, type: "link", referenceName: "NORAD - 9/18/2001", customSource: "NORAD", date: "9/18/2001" },
  { number: 3, type: "link", referenceName: "USA Today - 12/20/2001", customSource: "USA Today", date: "12/20/2001" }
]
OUTPUT links: [
  { title: "CNN - 9/12/2001", url: "http://www.cnn.com/2001/US/09/11/chronology.attack/" },
  { title: "NORAD - 9/18/2001", url: "https://web.archive.org/web/20030809155434/http:/www.norad.mil/" },
  { title: "USA Today - 12/20/2001", url: "https://usatoday30.usatoday.com/news/sept11/2001/12/19/usatcov-wtcsurvival.htm" }
]

Web page content:
${webContent}

Please return a JSON object with the following structure:
{
  "events": [
    {
      "title": "string - main event title",
      "description": "string - detailed description with [N] markers for footnotes",
      "startDateTime": "ISO 8601 date string or null",
      "endDateTime": "ISO 8601 date string or null (for events spanning time)",
      "importance": 1-5,
      "location": "string or null",
      "chains": ["array of chain names this event belongs to"]
    }
  ],
  "entities": [
    {
      "name": "string - entity name",
      "type": "person|place|organization|object|other",
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
      "sourceName": "string - name/title of source",
      "targetType": "event|entity",
      "targetName": "string - name/title of target",
      "relationshipType": "perpetrator_of|hijacker_of|victim_of|died_in|location_of|occurred_at|collided_with|damaged|investigated|investigated_by|reported_by|aboard|part_of_chain|involved_in",
      "context": "string - brief excerpt showing this relationship",
      "confidence": "explicit|inferred"
    }
  ],
  "chains": [
    {
      "name": "string - chain/category name",
      "description": "string - what this chain represents"
    }
  ],
  "attachments": [
    {
      "url": "string - image URL",
      "originalName": "string - filename or descriptive name",
      "type": "photo|document|other",
      "metadata": {
        "alt": "string - alt text",
        "caption": "string - caption text",
        "source": "string - image source/credit"
      }
    }
  ],
  "links": [
    {
      "title": "string - link title or source name",
      "url": "string - full URL",
      "description": "string - what this link references"
    }
  ],
  "footnotes": [
    {
      "number": 1,
      "type": "link|attachment",
      "referenceName": "string - name of the link or attachment this footnote refers to",
      "pageRange": "string or null - e.g., 'pp. 1-4, 6'",
      "customSource": "string or null - optional source override",
      "date": "string or null - date in flexible format"
    }
  ]
}

VALIDATION REQUIREMENTS:
- The "connections" array is MANDATORY and must contain at least one connection for EVERY entity in the "entities" array
- Before finalizing your response, verify that each entity name appears in at least one connection (either as sourceName or targetName)
- If an entity has no connections, REMOVE it from the entities array - orphaned entities are not allowed
- Count the entities and count the unique entity names in connections - they must match

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
- part_of_chain: Entity → Event chain it belongs to

EXAMPLE FOR CONTEXT:
If text says "Flight 11 slams into the WTC North Tower. Hijackers Mohamed Atta, Waleed Alshehri...", create:
- Event: "Flight 11 Hits North Tower"
- Entities: Mohamed Atta (person), Waleed Alshehri (person), Flight 11 (object), WTC North Tower (place)
- Connections:
  * Mohamed Atta (entity) → perpetrator_of → Flight 11 Hits North Tower (event)
  * Mohamed Atta (entity) → hijacker_of → Flight 11 (entity)
  * Flight 11 (entity) → collided_with → WTC North Tower (entity)
  * Flight 11 (entity) → involved_in → Flight 11 Hits North Tower (event)

FINAL VALIDATION CHECKLIST:
1. Only include items you can confidently extract
2. If no clear information is found, return empty arrays
3. For each entity in "entities" array, verify it appears in at least one connection in "connections" array
4. Remove any entities that don't have connections
5. The number of connections should be >= number of entities (each entity needs at least one)
6. Double-check entity names match exactly between "entities" and "connections" arrays

CRITICAL: Return ONLY the JSON object, with no additional text, explanations, or markdown formatting.
Do not wrap the JSON in markdown code blocks. Output raw JSON only.`;

    // Get LLM response with streaming
    try {
      console.log('Starting LLM processing with streaming...');
      const startTime = Date.now();

      const response = await ollama.chat({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: true,
        format: 'json', // Request JSON format output
      });

      // Collect streaming response
      let llmResponse = '';
      let tokenCount = 0;

      for await (const chunk of response) {
        if (chunk.message?.content) {
          llmResponse += chunk.message.content;
          tokenCount++;

          // Log progress every 50 tokens
          if (tokenCount % 50 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`Progress: ${tokenCount} tokens, ${elapsed}s elapsed, ${(tokenCount / parseFloat(elapsed)).toFixed(1)} tokens/sec`);
          }
        }
      }

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`LLM processing complete: ${tokenCount} tokens in ${totalTime}s (${(tokenCount / parseFloat(totalTime)).toFixed(1)} tokens/sec)`);
      console.log('LLM raw response (first 500 chars):', llmResponse.substring(0, 500));

      // Try to extract JSON from the response
      let parsedData;
      try {
        // Remove markdown code blocks if present
        let cleanedResponse = llmResponse.trim();

        // Remove ```json or ``` markers
        cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

        // Try to find JSON object boundaries
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonString = jsonMatch[0];
          console.log('Extracted JSON (first 500 chars):', jsonString.substring(0, 500));
          parsedData = JSON.parse(jsonString);
          console.log('Successfully parsed JSON. Keys:', Object.keys(parsedData));
        } else {
          console.error('No JSON object found in response');
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Full LLM response:', llmResponse);
        return NextResponse.json({
          error: 'Failed to parse LLM response as JSON',
          details: parseError instanceof Error ? parseError.message : 'Unknown error',
          rawResponse: llmResponse.substring(0, 1000) + (llmResponse.length > 1000 ? '...' : '')
        }, { status: 500 });
      }

      return NextResponse.json({
        url,
        parsed: parsedData,
        rawContent: webContent.substring(0, 500) + '...' // Preview of content
      });

    } catch (llmError) {
      console.error('LLM error:', llmError);

      if (llmError instanceof Error && (llmError.message.includes('connect') || llmError.message.includes('ECONNREFUSED'))) {
        const configuredModel = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
        return NextResponse.json({
          error: `Ollama server not available. Please install and start Ollama:\n\n1. Install: curl -fsSL https://ollama.ai/install.sh | sh\n2. Start: ollama serve\n3. Pull model: ollama pull ${configuredModel}`,
          instructions: {
            install: 'curl -fsSL https://ollama.ai/install.sh | sh',
            start: 'ollama serve',
            pullModel: `ollama pull ${configuredModel}`
          }
        }, { status: 503 });
      }

      return NextResponse.json({
        error: 'Failed to process content with LLM: ' + (llmError instanceof Error ? llmError.message : 'Unknown error')
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Parse URL API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}