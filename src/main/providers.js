// src/main/providers.js
// Provider registry for Supru

const fs = require('fs/promises');
const path = require('path');
const net = require('net');

// Use global fetch (Node 18+)
const { app } = global.electronMainExports || require('electron');

class ProviderService {
  constructor() {
    this.providers = new Map(); // providerId => { type, baseUrl, keyRef, defaultModel }
    this.providerIdCounter = 0;
    this._registryPath = null;
    this.autoDetectInterval = null;
    this._initialized = false;
  }

  async ensureInitialized() {
    if (this._initialized) return;
    this._initialized = true;
    await this.loadProviders();
    this.startAutoDetection();
  }

  get registryPath() {
    if (!this._registryPath) {
      this._registryPath = path.join(app.getPath('userData'), 'providers.json');
    }
    return this._registryPath;
  }

  /**
   * Load providers from the registry file.
   */
  async loadProviders() {
    try {
      const data = await fs.readFile(this.registryPath, 'utf8');
      const json = JSON.parse(data);
      for (const [id, provider] of Object.entries(json)) {
        this.providers.set(id, provider);
        this.providerIdCounter = Math.max(this.providerIdCounter, parseInt(id));
      }
    } catch (err) {
      // If file doesn't exist, that's okay; we start with an empty registry.
      if (err.code !== 'ENOENT') {
        console.error('Failed to load provider registry:', err);
      }
    }
  }

  /**
   * Save providers to the registry file.
   */
  async saveProviders() {
    const json = Object.fromEntries(this.providers);
    await fs.writeFile(this.registryPath, JSON.stringify(json, null, 2));
  }

  /**
   * Generate a new provider ID.
   * @returns {string}
   */
  generateId() {
    this.providerIdCounter += 1;
    return this.providerIdCounter.toString();
  }

  /**
   * Add a new provider.
   * @param {Object} providerData - { type, baseUrl, keyRef, defaultModel }
   * @returns {Promise<string>} The new provider ID.
   */
  async addProvider(providerData) {
    await this.ensureInitialized();
    const id = this.generateId();
    this.providers.set(id, { id, ...providerData });
    await this.saveProviders();
    return id;
  }

  /**
   * Remove a provider by ID.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async removeProvider(id) {
    await this.ensureInitialized();
    this.providers.delete(id);
    await this.saveProviders();
  }

  /**
   * Update a provider by ID.
   * @param {string} id
   * @param {Object} updates - Fields to update (type, baseUrl, keyRef, defaultModel)
   * @returns {Promise<void>}
   */
  async updateProvider(id, updates) {
    await this.ensureInitialized();
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Provider not found: ${id}`);
    Object.assign(provider, updates);
    await this.saveProviders();
  }

  /**
   * Get a provider by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  getProvider(id) {
    return this.providers.get(id) || null;
  }

  /**
   * List all providers.
   * @returns {Array<Object>} Array of provider objects (without exposing decrypted keys).
   */
  listProviders() {
    return Array.from(this.providers.values()).map(p => ({
      id: p.id,
      type: p.type,
      baseUrl: p.baseUrl,
      hasKey: !!p.keyRef,
      defaultModel: p.defaultModel
    }));
  }

  /**
   * Test a provider by attempting to fetch its models.
   * @param {string} id - Provider ID.
   * @returns {Promise<Object>} { success: boolean, models?: Array<string>, error?: string }
   */
  async testProvider(id) {
    await this.ensureInitialized();
    const provider = this.getProvider(id);
    if (!provider) {
      return { success: false, error: 'Provider not found' };
    }

    try {
      const models = await this.fetchModels(provider);
      return { success: true, models };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Fetch models from a provider.
   * @param {Object} provider - The provider object (with type, baseUrl, keyRef).
   * @returns {Promise<Array<string>>} List of model IDs.
   */
  async fetchModels(provider) {
    let url = new URL('/models', provider.baseUrl);
    let headers = {};

    if (provider.type === 'openai-compatible') {
      // For openai-compatible, we need to add the Authorization header if keyRef is present.
      if (provider.keyRef) {
        const token = await this.getKey(provider.keyRef);
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }
    } else if (provider.type === 'anthropic') {
      // Anthropic uses a different endpoint and headers.
      url = new URL('', provider.baseUrl);
      throw new Error('Model listing not supported for Anthropic provider');
    } else {
      throw new Error(`Unsupported provider type: ${provider.type}`);
    }

    // For openai-compatible, we proceed.
    if (provider.type === 'openai-compatible') {
      const response = await fetch(url.toString(), { headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const json = await response.json();
      if (json && json.data && Array.isArray(json.data)) {
        return json.data.map(m => m.id);
      } else {
        if (Array.isArray(json)) {
          return json.map(m => m.id || m);
        }
        throw new Error('Unexpected response format from models endpoint');
      }
    }
  }

  /**
   * Get the decrypted value of a keyRef.
   * @param {string} keyRef - Either 'env:VAR_NAME' or 'store:name'
   * @returns {Promise<string|null>} The decrypted value or null if not found.
   */
  async getKey(keyRef) {
    if (keyRef.startsWith('env:')) {
      const varName = keyRef.slice(4);
      return process.env[varName] || null;
    } else if (keyRef.startsWith('store:')) {
      const storeName = keyRef.slice(6);
      // Retrieve the secret from the secrets service
      const { secretsService } = require('./secrets');
      return await secretsService.get(storeName);
    } else {
      return keyRef;
    }
  }

  /**
   * Auto-detect Ollama and LM Studio.
   */
  startAutoDetection() {
    // Stop any existing interval
    if (this.autoDetectInterval) {
      clearInterval(this.autoDetectInterval);
    }
    // Check every 5 seconds
    this.autoDetectInterval = setInterval(async () => {
      await this.detectOllama();
      await this.detectLMStudio();
    }, 5000);
  }

  /**
   * Detect Ollama at http://localhost:11434.
   */
  async detectOllama() {
    // Check if we already have an Ollama provider
    const existing = Array.from(this.providers.values()).find(p =>
      p.baseUrl === 'http://localhost:11434/v1' && p.type === 'openai-compatible'
    );
    if (existing) return; // Already have it

    // Try to connect to Ollama
    try {
      const socket = new net.Socket();
      socket.setTimeout(1000);
      await new Promise((resolve, reject) => {
        socket.connect(11434, '127.0.0.1', () => {
          socket.end();
          resolve();
        });
        socket.on('error', (err) => {
          socket.destroy();
          reject(err);
        });
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('Timeout'));
        });
      });
      // If we get here, the port is open. Now try to fetch models.
      const provider = await this.addProvider({
        type: 'openai-compatible',
        baseUrl: 'http://localhost:11434/v1',
        keyRef: null, // No key needed for Ollama
        defaultModel: '' // We'll let the user choose or use a default
      });
      console.log('Auto-detected Ollama provider:', provider);
    } catch (err) {
      // Ollama not available, ignore.
    }
  }

  /**
   * Detect LM Studio at http://localhost:1234.
   */
  async detectLMStudio() {
    // Check if we already have an LM Studio provider
    const existing = Array.from(this.providers.values()).find(p =>
      p.baseUrl === 'http://localhost:1234/v1' && p.type === 'openai-compatible'
    );
    if (existing) return; // Already have it

    // Try to connect to LM Studio
    try {
      const socket = new net.Socket();
      socket.setTimeout(1000);
      socket.connect(1234, '127.0.0.1', () => {
        socket.end();
        // Port is open, now try to fetch models
        this.fetchModels({ type: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', keyRef: null })
          .then(models => {
            // If we get models, add the provider
            this.addProvider({
              type: 'openai-compatible',
              baseUrl: 'http://localhost:1234/v1',
              keyRef: null,
              defaultModel: models[0] || ''
            }).then(() => {
              console.log('Auto-detected LM Studio provider');
            });
          })
          .catch(err => {
            // Failed to fetch models, maybe LM Studio is not ready or doesn't have models endpoint.
          });
      });
      socket.on('error', (err) => {
        socket.destroy();
      });
      socket.on('timeout', () => {
        socket.destroy();
      });
    } catch (err) {
      // Ignore errors
    }
  }

  /**
   * Send a chat completion request to a provider.
   * @param {string} providerId - The ID of the provider to use.
   * @param {Array<Object>} messages - The chat messages in the format expected by the provider.
   * @param {Object} options - Optional parameters (temperature, maxTokens, etc.)
   * @returns {Promise<AsyncIterable<string>>} An async iterable of response chunks.
   */
  async *chatCompletion(providerId, messages, options = {}) {
    await this.ensureInitialized();
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    // Determine candidate models
    let candidateModels = [];
    if (options.model) {
      candidateModels = [options.model];
    } else {
      const defaultModel = provider.defaultModel;
      if (defaultModel && defaultModel !== 'Auto') {
        candidateModels = [defaultModel];
      } else {
        // Auto or empty: fetch models
        try {
          const models = await this.fetchModels(provider);
          candidateModels = models;
        } catch (err) {
          // If we cannot fetch models, we'll try with an empty model (let provider decide)
          candidateModels = [''];
        }
      }
    }

    // If no candidates, we'll try with empty string
    if (candidateModels.length === 0) {
      candidateModels = [''];
    }

    let lastError;
    for (const model of candidateModels) {
      try {
        const stream = await this._attemptChatCompletion(providerId, messages, options, model);
        // If we get here, the attempt succeeded; yield from the stream
        for await (const chunk of stream) {
          yield chunk;
        }
        return; // success
      } catch (err) {
        lastError = err;
        // Check if it's an auth error (401/403)
        if (err.status === 401 || err.status === 403) {
          // Stop falling back on auth error
          throw err;
        }
        // Otherwise, try next model
        continue;
      }
    }
    // If we tried all candidates and none worked
    throw lastError;
  }

  /**
   * Attempt chat completion with a specific model, throwing on failure.
   * @param {string} providerId - The ID of the provider to use.
   * @param {Array<Object>} messages - The chat messages in the format expected by the provider.
   * @param {Object} options - Optional parameters (temperature, maxTokens, etc.)
   * @param {string} model - The model to use.
   * @returns {Promise<AsyncIterable<string>>} An async iterable of response chunks.
   */
  async _attemptChatCompletion(providerId, messages, options, model) {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    let url, headers, body;

    if (provider.type === 'openai-compatible') {
      url = new URL('/chat/completions', provider.baseUrl);
      headers = { 'Content-Type': 'application/json' };
      if (provider.keyRef) {
        const token = await this.getKey(provider.keyRef);
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }
      body = {
        model,
        messages,
        stream: true,
        ...options
      };
    } else if (provider.type === 'anthropic') {
      url = new URL('/v1/messages', provider.baseUrl);
      headers = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      };
      if (provider.keyRef) {
        const token = await this.getKey(provider.keyRef);
        if (token) {
          headers['x-api-key'] = token;
        }
      }
      // Convert messages to Anthropic format
      const anthropicMessages = messages.map(m => {
        if (m.role === 'system') {
          return null;
        }
        return {
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        };
      }).filter(Boolean);

      const systemMessage = messages.find(m => m.role === 'system');
      body = {
        model,
        messages: anthropicMessages,
        system: systemMessage ? systemMessage.content : '',
        stream: true,
        ...options
      };
    } else {
      throw new Error(`Unsupported provider type: ${provider.type}`);
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      throw error;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    return {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            try {
              const { done, value } = await reader.read();
              if (done) {
                return { done: true };
              }
              buffer += decoder.decode(value, { stream: true });
              let lines = buffer.split('\n');
              buffer = lines.pop();
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') {
                    return { done: true };
                  }
                  try {
                    const json = JSON.parse(data);
                    let chunk = '';
                    if (provider.type === 'openai-compatible') {
                      chunk = json.choices[0]?.delta?.content || '';
                    } else if (provider.type === 'anthropic') {
                      chunk = json.delta?.text || '';
                    }
                    if (chunk) {
                      return { done: false, value: chunk };
                    }
                  } catch (err) {
                    // Ignore parsing errors for individual chunks
                  }
                }
              }
              return this.next();
            } catch (err) {
              reader.release();
              throw err;
            }
          }
        };
      }
    };
  }
}

// Export a singleton instance
const providerService = new ProviderService();
module.exports = { providerService };