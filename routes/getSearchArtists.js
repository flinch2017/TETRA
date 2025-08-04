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

// GET /search-artists?q=...
router.get('/search-artists', compCheck, async (req, res) => {
  try {
    const q = req.query.q;
    const currentUserAcode = req.session.user?.acode;

    if (!q || q.trim() === '') {
      return res.json([]); // empty query
    }

    const searchQuery = `
      SELECT acode, artist_name, pfp_url
      FROM users
      WHERE LOWER(artist_name) LIKE LOWER($1)
      AND acode != $2
      LIMIT 10
    `;

    const { rows } = await pool.query(searchQuery, [`%${q}%`, currentUserAcode]);

    // generate presigned URLs
    const artistsWithPfp = await Promise.all(rows.map(async user => {
      let presignedPfpUrl;
      if (user.pfp_url) {
        const filename = user.pfp_url.split('/').pop(); // get filename
        presignedPfpUrl = await generatePresignedUrl(`pfp/${filename}`);
      } else {
        presignedPfpUrl = await generatePresignedUrl('drawables/default_pfp.png');
      }
      return {
        acode: user.acode,
        artist_name: user.artist_name,
        pfp_url: presignedPfpUrl
      };
    }));

    res.json(artistsWithPfp);
  } catch (err) {
    console.error('Error searching artists:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});


module.exports = router;