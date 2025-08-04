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
  try {
    const loggedInUser = req.session.user;
    const decryptedAcode = loggedInUser.acode; // ✅ Use only session acode
    const { username, artistName, genre, bio } = req.body;

    // Validate username
    const usernameRegex = /^[a-z0-9._-]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        message: 'Username must be 3–30 characters and contain only lowercase letters, numbers, and symbols (._-).'
      });
    }

    // Check for username conflicts
    const usernameCheck = await pool.query(
      'SELECT 1 FROM users WHERE username = $1 AND acode != $2',
      [username, decryptedAcode]
    );
    if (usernameCheck.rowCount > 0) {
      return res.status(409).json({ message: 'Username is already taken.' });
    }

    const userResult = await pool.query(
      'SELECT pfp_url, account_mode FROM users WHERE acode = $1',
      [decryptedAcode]
    );
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const oldPfpUrl = user.pfp_url;
    const accountMode = user.account_mode;
    let pfpUrl = null;
    let oldPfpKey = null;

    if (req.file) {
      pfpUrl = await uploadToS3(req.file, 'pfp/', decryptedAcode);

      // Extract S3 key if existing banner exists
      const s3Prefix = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
      if (oldPfpUrl?.startsWith(s3Prefix)) {
        oldPfpKey = oldPfpUrl.slice(s3Prefix.length);
      }
    }

    // Build SQL update
    const updateFields = ['username = $1'];
    const values = [username];

    // Only update artist fields if account_mode === 'artist'
    if (accountMode === 'artist') {
      updateFields.push('artist_name = $2', 'main_genre = $3', 'bio = $4');
      values.push(artistName || '', genre || '', bio || '');
    }

    if (pfpUrl) {
      updateFields.push(`pfp_url = $${values.length + 1}`);
      values.push(pfpUrl);
    }

    values.push(decryptedAcode);
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE acode = $${values.length}`;
    await pool.query(query, values);

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