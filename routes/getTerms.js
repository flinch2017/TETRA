const express = require('express');
const multer = require('multer');
const uploadToS3 = require('../utils/uploadToS3');
const { encrypt, decrypt } = require('../utils/encryption.js');
const pool = require('../utils/db');



const router = express.Router();
const moment = require('moment');

const generatePresignedUrl = require('../utils/s3Presign');
const uploadTrackToS3 = require('../utils/uploadTrackToS3');
const deleteFromS3 = require('../utils/s3Delete');
const uploadArtworkToS3 = require('../utils/uploadArtworkToS3');
const uploadCanvasToS3 = require('../utils/uploadCanvasToS3');
const compCheck = require('../middleware/compCheck.js');
const path = require('path');

const expressLayouts = require('express-ejs-layouts');



router.get('/terms-conditions', async (req, res) => {
  let userAcode = req.session.user?.acode || null;
  let pfpUrl = null;
  let showHeader = true;
  let showMusicBar = true;

  try {
    if (userAcode) {
      // Fetch pfp_url from database
      const result = await pool.query(
        'SELECT pfp_url FROM users WHERE acode = $1 LIMIT 1',
        [userAcode]
      );

      if (result.rows.length && result.rows[0].pfp_url) {
        const filename = result.rows[0].pfp_url.split('/').pop();
        pfpUrl = await generatePresignedUrl(`pfp/${filename}`);
      }
    }

    // Hide header/music bar if missing userAcode or pfpUrl
    if (!userAcode || !pfpUrl) {
      showHeader = false;
      showMusicBar = false;
    }
  } catch (err) {
    console.error('Error fetching profile data:', err);
    showHeader = false;
    showMusicBar = false;
  }

  res.render('termsConditions', {
    siteName: 'TETRA METROPOLIS',
    siteUrl: 'https://tetrometro.com',
    effectiveDate: 'August 10, 2025',
    supportEmail: 'support@tetrametro.com',
    userAcode,
    pfpUrl,
    showHeader,
    showMusicBar
  });
});


module.exports = router;
