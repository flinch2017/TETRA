const express = require('express');
const multer = require('multer');

const uploadToS3 = require('../utils/uploadToS3');
const { encrypt, decrypt } = require('../utils/encryption.js');
const pool = require('../utils/db');
const crypto = require('crypto');

const router = express.Router();
const moment = require('moment');

const generatePresignedUrl = require('../utils/s3Presign');
const uploadTrackToS3 = require('../utils/uploadTrackToS3');
const deleteFromS3 = require('../utils/s3Delete');
const uploadArtworkToS3 = require('../utils/uploadArtworkToS3');
const uploadCanvasToS3 = require('../utils/uploadCanvasToS3');
const compCheck = require('../middleware/compCheck.js');
const upload = require('../middleware/multer-setup.js');

router.post('/check-duplicates', async (req, res) => {
  const { isrcs, upc } = req.body;

  try {
    const duplicateISRCs = [];
    let duplicateUPC = false;

    if (Array.isArray(isrcs) && isrcs.length > 0) {
      // Check existing ISRCs
      const { rows } = await pool.query(
        'SELECT isrc FROM tracks WHERE isrc = ANY($1)',
        [isrcs]
      );
      rows.forEach(row => duplicateISRCs.push(row.isrc));
    }

    if (upc) {
      // Check if UPC already exists
      const { rows } = await pool.query(
        'SELECT 1 FROM albums WHERE upc = $1 LIMIT 1',
        [upc]
      );
      if (rows.length > 0) {
        duplicateUPC = true;
      }
    }

    res.json({ duplicateISRCs, duplicateUPC });
  } catch (err) {
    console.error('Error checking duplicates:', err);
    res.status(500).json({ message: 'Server error checking duplicates' });
  }
});


module.exports = router;