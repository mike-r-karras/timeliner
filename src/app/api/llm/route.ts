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

    const { prompt, model = 'llama3.2', stream = false } = await request.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const response = await ollama.chat({
      model,
      messages: [
        {
          role: 'user',
          content: prompt.trim(),
        },
      ],
      stream,
    });

    if (stream) {
      // For streaming responses
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          (async () => {
            try {
              for await (const part of response as any) {
                const data = JSON.stringify({ content: part.message.content });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            } catch (error) {
              console.error('Streaming error:', error);
              controller.error(error);
            }
          })();
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // For non-streaming responses
      return NextResponse.json({
        response: (response as any).message.content,
        model,
        created_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('LLM API error:', error);

    if (error instanceof Error && error.message.includes('connect')) {
      return NextResponse.json(
        { error: 'Ollama server not available. Please ensure Ollama is running.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get list of available models
    const models = await ollama.list();

    return NextResponse.json({
      models: models.models.map(model => ({
        name: model.name,
        size: model.size,
        modified_at: model.modified_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching models:', error);

    if (error instanceof Error && error.message.includes('connect')) {
      return NextResponse.json(
        { error: 'Ollama server not available. Please ensure Ollama is running.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}