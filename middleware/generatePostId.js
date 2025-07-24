const crypto = require('crypto');

function generatePostId(length = 20) {
  return crypto.randomBytes(30)
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, length);
}

module.exports = generatePostId;
