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

    const { url, model = 'llama3.2' } = await request.json();
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
    const prompt = `Analyze the following web page content and extract structured data that could be used to create timeline events or entities. Look for:

- Event titles/names
- Dates (start and end dates if available)
- Descriptions
- Locations (places, addresses, coordinates if mentioned)
- People/entities involved
- Importance/significance indicators
- Any other relevant timeline information

Web page content:
${webContent}

Please return a JSON object with the following structure:
{
  "events": [
    {
      "title": "string",
      "description": "string",
      "startDateTime": "ISO date string or null",
      "endDateTime": "ISO date string or null",
      "importance": 1-5,
      "location": "string or null"
    }
  ],
  "entities": [
    {
      "name": "string",
      "type": "person|place|organization|other",
      "description": "string",
      "importance": 1-5
    }
  ],
  "locations": [
    {
      "name": "string",
      "address": "string or null",
      "description": "string or null"
    }
  ]
}

Only include items you can confidently extract. If no clear information is found, return empty arrays. Do not make up or assume information not present in the content.`;

    // Get LLM response
    try {
      const response = await ollama.chat({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: false,
      });

      const llmResponse = (response as any).message.content;

      // Try to extract JSON from the response
      let parsedData;
      try {
        // Look for JSON in the response
        const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return NextResponse.json({
          error: 'Failed to parse LLM response as JSON',
          rawResponse: llmResponse
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
        return NextResponse.json({
          error: 'Ollama server not available. Please install and start Ollama:\n\n1. Install: curl -fsSL https://ollama.ai/install.sh | sh\n2. Start: ollama serve\n3. Pull model: ollama pull llama3.2',
          instructions: {
            install: 'curl -fsSL https://ollama.ai/install.sh | sh',
            start: 'ollama serve',
            pullModel: 'ollama pull llama3.2'
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