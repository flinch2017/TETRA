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
const generatePostId = require('../middleware/generatePostId.js');
const path = require('path');


router.get('/create-post', async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT pfp_url, acode FROM users WHERE acode = $1',
      [req.session.user.acode]
    );

    const userRow = userResult.rows[0];

    let presignedPfpUrl = null;
    if (userRow?.pfp_url) {
      const filename = userRow.pfp_url.split('/').pop();
      presignedPfpUrl = await generatePresignedUrl(`pfp/${filename}`);
    } else {
      presignedPfpUrl = await generatePresignedUrl('drawables/default_pfp.png');
    }

    res.render('posting', {
      pfpUrl: presignedPfpUrl,
      userAcode: userRow?.acode // ✅ pass the user's acode to EJS
    });
  } catch (err) {
    console.error('Error fetching profile picture for create-post:', err);
    res.status(500).send('Something went wrong.');
  }
});


module.exports = router;