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


router.get('/submission', async (req, res) => { 
  try {
    const userResult = await pool.query(
      'SELECT pfp_url, acode FROM users WHERE acode = $1',
      [req.session.user.acode]
    );
    const userRow = userResult.rows[0];

    let presignedPfpUrl;
    if (userRow?.pfp_url) {
      const filename = userRow.pfp_url.split('/').pop();
      presignedPfpUrl = await generatePresignedUrl(`pfp/${filename}`);
    } else {
      presignedPfpUrl = await generatePresignedUrl('drawables/default_pfp.png');
    }

    // get release type from query
    const releaseType = req.query.type;

    // decide template based on type
    let template;
    if (releaseType === 'single') {
      template = 'release-single';
    } else if (releaseType === 'ep') {
      template = 'release-ep';
    } else if (releaseType === 'album') {
      template = 'release-album';
    } else {
      return res.status(400).send('Invalid release type.');
    }

    // generate releaseId
    const releaseId = Array.from(crypto.randomBytes(12))
      .map(byte => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[byte % 62])
      .join('');

    res.render(template, {
      pfpUrl: presignedPfpUrl,
      userAcode: userRow?.acode,
      releaseType,
      releaseId,
      currentUser: userRow?.acode   // ✅ set currentUser to the acode
    });
  } catch (err) {
    console.error('Error fetching profile picture for submission page:', err);
    res.status(500).send('Something went wrong.');
  }
});


module.exports = router;