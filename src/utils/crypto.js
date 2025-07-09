const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest(); // 32 bytes
const IV = Buffer.alloc(16, 0); // fixed IV for simplicity; in production, a random IV is safer

function encrypt(text) {
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, IV);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Convert to URL-safe Base64
  return encrypted.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decrypt(encryptedUrlSafe) {
  try {
    // Convert URL-safe Base64 back to standard Base64
    const base64 = encryptedUrlSafe.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');

    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, IV);
    let decrypted = decipher.update(padded, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('❌ Failed to decrypt overlay ID:', err.message);
    throw new Error('Invalid overlay ID');
  }
}

module.exports = { encrypt, decrypt };
