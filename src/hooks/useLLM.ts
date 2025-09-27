import { useState, useCallback } from 'react';

interface LLMResponse {
  response: string;
  model: string;
  created_at: string;
}

interface Model {
  name: string;
  size: number;
  modified_at: string;
}

interface UseLLMReturn {
  response: string | null;
  loading: boolean;
  error: string | null;
  models: Model[];
  modelsLoading: boolean;
  chat: (prompt: string, model?: string) => Promise<void>;
  fetchModels: () => Promise<void>;
  clearResponse: () => void;
}

export function useLLM(): UseLLMReturn {
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const chat = useCallback(async (prompt: string, model = 'llama3.2') => {
    if (!prompt.trim()) {
      setError('Prompt cannot be empty');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: LLMResponse = await response.json();
      setResponse(data.response);
    } catch (err) {
      console.error('LLM chat error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchModels = useCallback(async () => {
    setModelsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/llm');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setModels(data.models || []);
    } catch (err) {
      console.error('Error fetching models:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch models');
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const clearResponse = useCallback(() => {
    setResponse(null);
    setError(null);
  }, []);

  return {
    response,
    loading,
    error,
    models,
    modelsLoading,
    chat,
    fetchModels,
    clearResponse,
  };
}