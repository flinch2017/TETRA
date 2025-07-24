const express = require('express');
const multer = require('multer');
const path = require('path');
const uploadToS3 = require('../utils/uploadToS3');
const { encrypt, decrypt } = require('../utils/encryption.js');
const pool = require('../utils/db');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const router = express.Router();
const moment = require('moment');
const paypal = require('@paypal/checkout-server-sdk');
const generatePresignedUrl = require('../utils/s3Presign');
const uploadTrackToS3 = require('../utils/uploadTrackToS3');
const deleteFromS3 = require('../utils/s3Delete');
const uploadArtworkToS3 = require('../utils/uploadArtworkToS3');
const uploadCanvasToS3 = require('../utils/uploadCanvasToS3');
const compCheck = require('../middleware/compCheck.js');
const upload = require('../middleware/multer-setup.js');

router.post('/update-artist', compCheck, upload.single('banner'), async (req, res) => {
  const { artistName, genre, bio, acode } = req.body;

  if (!acode) {
    return res.status(400).json({ message: 'Missing acode.' });
  }

  try {
    const decryptedAcode = decrypt(acode);
    let pfpUrl = null;
    let oldPfpKey = null;

    // Step 1: Fetch current pfp_url
    const userResult = await pool.query('SELECT pfp_url, account_mode FROM users WHERE acode = $1', [decryptedAcode]);
    const user = userResult.rows[0];
    const accountMode = user?.account_mode;
    const oldPfpUrl = user?.pfp_url;

    // Step 2: If a new file is uploaded, upload new one and schedule deletion of old
    if (req.file) {
      pfpUrl = await uploadToS3(req.file, 'pfp/', decryptedAcode);

      // Step 3: Extract key from old S3 URL if exists
      if (oldPfpUrl) {
        const s3UrlPrefix = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
        if (oldPfpUrl.startsWith(s3UrlPrefix)) {
          oldPfpKey = oldPfpUrl.slice(s3UrlPrefix.length);
        }
      }
    }

    // Step 4: Build dynamic update query
    const updateFields = ['artist_name = $1', 'main_genre = $2', 'bio = $3'];
    const values = [artistName, genre, bio];

    if (!accountMode || accountMode === 'regular') {
      updateFields.push('account_mode = $' + (values.length + 1));
      values.push('artist');
    }

    if (pfpUrl) {
      updateFields.push('pfp_url = $' + (values.length + 1));
      values.push(pfpUrl);
    }

    values.push(decryptedAcode);
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE acode = $${values.length}`;
    await pool.query(query, values);

    // Step 5: Delete the old profile picture from S3
    if (oldPfpKey) {
  await deleteFromS3(oldPfpKey);
}


    res.json({ success: true });
  } catch (err) {
    console.error('Error updating artist profile:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});


module.exports = router;