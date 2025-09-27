'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
} from '@mui/material';
import { Send, Psychology, Refresh } from '@mui/icons-material';
import { useLLM } from '@/hooks/useLLM';

export default function LLMChat() {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('llama3.2');
  const {
    response,
    loading,
    error,
    models,
    modelsLoading,
    chat,
    fetchModels,
    clearResponse,
  } = useLLM();

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    await chat(prompt, selectedModel);
  };

  const handleClear = () => {
    clearResponse();
    setPrompt('');
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Psychology sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h5">LLM Chat</Typography>
        <Chip
          label="Powered by Ollama"
          size="small"
          variant="outlined"
          sx={{ ml: 'auto' }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={clearResponse}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Model</InputLabel>
            <Select
              value={selectedModel}
              label="Model"
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={modelsLoading}
            >
              {models.length > 0 ? (
                models.map((model) => (
                  <MenuItem key={model.name} value={model.name}>
                    {model.name}
                  </MenuItem>
                ))
              ) : (
                <MenuItem value="llama3.2">llama3.2 (default)</MenuItem>
              )}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            size="small"
            onClick={fetchModels}
            disabled={modelsLoading}
            startIcon={modelsLoading ? <CircularProgress size={16} /> : <Refresh />}
          >
            Refresh Models
          </Button>
        </Box>

        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask me anything..."
              disabled={loading}
              variant="outlined"
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={loading || !prompt.trim()}
                startIcon={loading ? <CircularProgress size={16} /> : <Send />}
              >
                Send
              </Button>
              {(response || error) && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleClear}
                  disabled={loading}
                >
                  Clear
                </Button>
              )}
            </Box>
          </Box>
        </form>
      </Box>

      {response && (
        <Paper sx={{ p: 3, backgroundColor: 'grey.50' }}>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Response:
          </Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {response}
          </Typography>
        </Paper>
      )}

      {models.length === 0 && !modelsLoading && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>To use the LLM feature:</strong>
            <br />
            1. Install Ollama: <code>curl -fsSL https://ollama.ai/install.sh | sh</code>
            <br />
            2. Pull a model: <code>ollama pull llama3.2</code>
            <br />
            3. Start Ollama: <code>ollama serve</code>
            <br />
            4. Refresh models above
          </Typography>
        </Alert>
      )}
    </Box>
  );
}