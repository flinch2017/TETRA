const express = require('express');
const multer = require('multer');

const uploadToS3 = require('../utils/uploadToS3.js');
const { encrypt, decrypt } = require('../utils/encryption.js');
const pool = require('../utils/db.js');
const crypto = require('crypto');

const router = express.Router();
const moment = require('moment');

const generatePresignedUrl = require('../utils/s3Presign.js');
const uploadTrackToS3 = require('../utils/uploadTrackToS3.js');
const deleteFromS3 = require('../utils/s3Delete.js');
const uploadArtworkToS3 = require('../utils/uploadArtworkToS3.js');
const uploadCanvasToS3 = require('../utils/uploadCanvasToS3.js');
const compCheck = require('../middleware/compCheck.js');
const { v4: uuidv4 } = require('uuid');
const geoip = require('geoip-lite');

router.post('/api/log-stream', async (req, res) => {
  const { track_id } = req.body;
  const user = req.session.user;

  if (!user || !track_id) {
    return res.status(400).json({ error: 'Missing user session or track ID' });
  }

  try {
    const stream_id = `stream_${uuidv4().slice(0, 8)}`;
    const acode = user.acode;
    const verified = 'Yes';
    const platform = req.headers['user-agent'].includes('Android') ? 'App' : 'Web';
    const device = req.headers['user-agent'] || 'Unknown';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Lookup geo data
    const geo = geoip.lookup(ip) || {};
    const country = geo.country || 'Unknown';
    const city = geo.city || 'Unknown';

    await pool.query(`
      INSERT INTO streams (
        stream_id, track_id, acode, date, verified,
        device, platform, country, city, ip_address
      ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9)
    `, [
      stream_id,
      track_id,
      acode,
      verified,
      device,
      platform,
      country,
      city,
      ip
    ]);

    res.status(200).json({ message: 'Stream logged successfully' });
  } catch (err) {
    console.error('Failed to log stream:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
