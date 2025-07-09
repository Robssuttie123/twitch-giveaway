const crypto = require('crypto');
require('dotenv').config();

const secret = process.env.OVERLAY_SECRET || 'supersecretpassword';
const key = crypto.scryptSync(secret, 'streamer-salt', 32); // 32 bytes for AES-256
const iv = Buffer.alloc(16, 0); // Static IV for AES-256-CBC

function encrypt(text) {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

function decrypt(encrypted) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encrypt, decrypt };
