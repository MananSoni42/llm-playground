import React, { useState, useEffect } from 'react';
import './ApiConfig.css';

const modelOptions = {
  google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-pro', 'gemini-2.0-flash'],
  anthropic: ['claude-opus-4-1-20250805', 'claude-sonnet-4-20250514', 'claude-3.5-sonnet', 'claude-3.5-haiku', 'claude-3-opus'],
  openai: ['gpt-5', 'gpt-5-mini', 'o3', 'o4-mini', 'gpt-4.1'],
  local: [],
  custom: [],
};

const ApiConfig = ({ onSave, onClose }) => {
  const [provider, setProvider] = useState('google');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [model, setModel] = useState(modelOptions.google[0]);
  const [customUrl, setCustomUrl] = useState('');
  const [localPort, setLocalPort] = useState('8080');

  useEffect(() => {
    const storedConfig = localStorage.getItem('apiConfig');
    if (storedConfig) {
      const config = JSON.parse(storedConfig);
      setProvider(config.provider);
      setApiKey(config.apiKey);
      setApiUrl(config.apiUrl);
      setModel(config.model);
      setCustomUrl(config.customUrl || '');
      setLocalPort(config.localPort || '8080');
    }
  }, []);

  useEffect(() => {
    let url = '';
    switch (provider) {
      case 'google':
        url = 'https://generativelanguage.googleapis.com/v1beta/openai/';
        break;
      case 'anthropic':
        url = 'https://api.anthropic.com/v1/messages';
        break;
      case 'openai':
        url = 'https://api.openai.com/v1/chat/completions';
        break;
      case 'local':
        url = `http://localhost:${localPort}/v1/chat/completions`;
        break;
      case 'custom':
        url = customUrl;
        break;
      default:
        url = '';
    }
    setApiUrl(url);
    if (modelOptions[provider] && modelOptions[provider].length > 0) {
      setModel(modelOptions[provider][0]);
    } else {
      setModel('');
    }
  }, [provider, localPort, customUrl]);

  const handleSave = () => {
    const config = { provider, apiKey, apiUrl, model, customUrl, localPort };
    localStorage.setItem('apiConfig', JSON.stringify(config));
    onSave(config);
    onClose();
  };

  return (
    <div className="api-config-overlay" onClick={onClose}>
      <div className="api-config-modal" onClick={(e) => e.stopPropagation()}>
        <h2>API Configuration</h2>
        <label>
          Provider:
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="google">Google</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="local">Local</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>
          API URL:
          <input type="text" value={apiUrl} readOnly />
        </label>
        {provider === 'local' && (
          <label>
            Port:
            <input
              type="text"
              value={localPort}
              onChange={(e) => setLocalPort(e.target.value)}
            />
          </label>
        )}
        {provider === 'custom' && (
          <label>
            Custom URL:
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
            />
          </label>
        )}
        {modelOptions[provider] && modelOptions[provider].length > 0 && (
          <label>
            Model:
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {modelOptions[provider].map((modelName) => (
                <option key={modelName} value={modelName}>
                  {modelName}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          API Key:
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </label>
        <div className="api-config-buttons">
          <button onClick={handleSave}>Save</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default ApiConfig;
