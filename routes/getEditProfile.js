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


// GET /edit-profile
router.get('/edit-profile', compCheck, async (req, res) => {
  const { acode } = req.query;

  if (!acode) {
    return res.status(400).send('Missing acode.');
  }

  try {
    // Decrypt the acode from query
    const decryptedAcode = decrypt(acode);

    const result = await pool.query(
  'SELECT artist_name, main_genre, bio, username, pfp_url, acode, account_mode FROM users WHERE acode = $1',
  [decryptedAcode]
);


    if (result.rowCount === 0) {
      return res.status(404).send('User not found.');
    }

    const user = result.rows[0];

    // Encrypt acode again for safe form use
    const encryptedAcode = encrypt(user.acode);

    // Generate presigned pfp URL
    let presignedPfpUrl;
    if (user.pfp_url) {
      const filename = user.pfp_url.split('/').pop();
      presignedPfpUrl = await generatePresignedUrl(`pfp/${filename}`);
    } else {
      presignedPfpUrl = await generatePresignedUrl('drawables/banner_default.png');
    }

    // ✅ Always include current logged-in user's acode from session
    const userAcode = req.session.user.acode;

    res.render('edit-profile', {
  user: {
    artistName: user.artist_name,
    genre: user.main_genre,
    bio: user.bio,
    username: user.username,
    acode: encryptedAcode,
    accountMode: user.account_mode // <-- include this
  },
  pfpUrl: presignedPfpUrl,
  userAcode
});



  } catch (err) {
    console.error('Error loading edit profile:', err);
    res.status(500).send('Server error.');
  }
});

module.exports = router;