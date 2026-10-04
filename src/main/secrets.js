// src/main/secrets.js
// Secure storage for API keys using Electron's safeStorage

const fs = require('fs/promises');
const fssync = require('fs');
const path = require('path');

// Get safeStorage from global electronMainExports (set by entry.mjs)
const { safeStorage } = global.electronMainExports || require('electron');
const { app } = global.electronMainExports || require('electron');

/**
 * Secrets service for storing and retrieving sensitive data like API keys.
 * Uses Electron's safeStorage for encryption when available, falls back to plain text in development.
 */
class SecretsService {
  constructor() {
    this._storagePath = null;
    this.secrets = new Map(); // name => encryptedValue
    this._initialized = false;
  }

  ensureInitialized() {
    if (this._initialized) return;
    this._initialized = true;
    this.loadSecretsSync();
  }

  get storagePath() {
    if (!this._storagePath) {
      this._storagePath = path.join(app.getPath('userData'), 'secrets.json');
    }
    return this._storagePath;
  }

  /** Load secrets from the storage file synchronously. */
  loadSecretsSync() {
    try {
      const data = fssync.readFileSync(this.storagePath, 'utf8');
      const json = JSON.parse(data);
      for (const [name, encrypted] of Object.entries(json)) {
        this.secrets.set(name, encrypted);
      }
    } catch (err) {
      // If file doesn't exist, that's okay; we start with an empty store.
      if (err.code !== 'ENOENT') {
        console.error('Failed to load secrets:', err);
      }
    }
  }

  /** @deprecated Use loadSecretsSync instead */
  async loadSecrets() {
    // Kept for backward compatibility but does nothing now
    return;
  }

  /**
   * Save secrets to the storage file.
   */
  async saveSecrets() {
    this.ensureInitialized();
    const json = Object.fromEntries(this.secrets);
    await fs.writeFile(this.storagePath, JSON.stringify(json, null, 2));
  }

  /**
   * Store a secret.
   * @param {string} name - The name/identifier for the secret.
   * @param {string} value - The plaintext secret value (e.g., API key).
   * @returns {Promise<void>}
   */
  async set(name, value) {
    this.ensureInitialized();
    let encrypted;
    try {
      // Use Electron's safeStorage to encrypt the value
      encrypted = safeStorage.encryptString(value);
      // Convert the encrypted Buffer to a base64 string for storage
      encrypted = encrypted.toString('base64');
    } catch (err) {
      // If encryption fails (e.g., in testing environment), store as plain text with a warning.
      // In production, we should not fall back to plain text.
      console.warn('Failed to encrypt secret, storing as plain text (not secure):', err);
      encrypted = value;
    }
    this.secrets.set(name, encrypted);
    await this.saveSecrets();
  }

  /**
   * Retrieve a secret.
   * @param {string} name - The name/identifier for the secret.
   * @returns {Promise<string|null>} The decrypted secret value, or null if not found.
   */
  async get(name) {
    this.ensureInitialized();
    const encrypted = this.secrets.get(name);
    if (encrypted === undefined) {
      return null;
    }

    try {
      // Convert the base64 string back to a Buffer
      const buffer = Buffer.from(encrypted, 'base64');
      // Use Electron's safeStorage to decrypt the value
      const decrypted = safeStorage.decryptString(buffer);
      return decrypted;
    } catch (err) {
      // If decryption fails, assume the value is stored as plain text (fallback).
      console.warn('Failed to decrypt secret, returning as plain text:', err);
      return encrypted;
    }
  }

  /**
   * Remove a secret.
   * @param {string} name - The name/identifier for the secret.
   * @returns {Promise<void>}
   */
  async remove(name) {
    this.ensureInitialized();
    this.secrets.delete(name);
    await this.saveSecrets();
  }

  /**
   * List all secret names (but not their values).
   * @returns {Array<string>} Array of secret names.
   */
  list() {
    this.ensureInitialized();
    return Array.from(this.secrets.keys());
  }

  /**
   * Check if a secret exists.
   * @param {string} name - The name/identifier for the secret.
   * @returns {boolean} True if the secret exists.
   */
  has(name) {
    this.ensureInitialized();
    return this.secrets.has(name);
  }
}

// Export a singleton instance
const secretsService = new SecretsService();
module.exports = { secretsService };