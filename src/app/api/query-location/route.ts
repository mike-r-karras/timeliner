import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Ollama } from 'ollama';

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434'
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { locationName, model = process.env.OLLAMA_MODEL || 'qwen2.5:7b' } = await request.json();
    console.log('Location query request:', { locationName, model });

    if (!locationName?.trim()) {
      return NextResponse.json({ error: 'Location name is required' }, { status: 400 });
    }


    // Create LLM prompt for parsing entity data
    const prompt = `
        Look up the address of ${locationName} and return it as a formatted address. If there are more than one possible addresses, return a JSON array of probable addresses. use the field labels 'streetAddress', 'city', 'stateProvince', 'postalCode', 'country', 'latitude', 'longitude', 'additionalInfo'. Return only the json with no other commentary.`;
    console.log('Generated prompt:', prompt);

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
        locationName: locationName,
        parsed: parsedData,
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