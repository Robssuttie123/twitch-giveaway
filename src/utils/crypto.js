const crypto = require('crypto');
require('dotenv').config();

const secret = process.env.OVERLAY_SECRET || 'supersecretpassword';
const key = crypto.scryptSync(secret, 'streamer-salt', 32); // 32 bytes for AES-256
const iv = Buffer.alloc(16, 0); // Static IV for AES-256-CBC

function encrypt(text) {
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, IV);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encodeURIComponent(encrypted); // ← this is key!
}

function decrypt(encrypted) {
  const decoded = decodeURIComponent(encrypted); // ← decode before decrypting
  const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, IV);
  let decrypted = decipher.update(decoded, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encrypt, decrypt };
