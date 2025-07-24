const express = require('express');
const multer = require('multer');
const path = require('path');
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


router.post('/follow', compCheck, async (req, res) => {
  const loggedInUser = req.session.user;
  let { targetAcode } = req.body;

  if (!targetAcode || targetAcode === loggedInUser.acode) {
    return res.status(400).json({ success: false, message: 'Invalid target.' });
  }

  try {
    targetAcode = decrypt(targetAcode); // raw

    const followId = crypto.randomBytes(15).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);

    const existing = await pool.query(
      'SELECT 1 FROM follows WHERE follower_acode = $1 AND following_acode = $2',
      [loggedInUser.acode, targetAcode]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({ success: false, message: 'Already following' });
    }

    await pool.query(
      'INSERT INTO follows (follow_id, follower_acode, following_acode) VALUES ($1, $2, $3)',
      [followId, loggedInUser.acode, targetAcode]
    );

    res.json({ success: true, message: 'Followed successfully' });
  } catch (err) {
    console.error('Error following artist:', err);
    res.status(500).json({ success: false, message: 'Failed to follow' });
  }
});


router.post('/unfollow', compCheck, async (req, res) => {
  const loggedInUser = req.session.user;
  let { targetAcode } = req.body;

  if (!targetAcode || targetAcode === loggedInUser.acode) {
    return res.status(400).json({ success: false, message: 'Invalid target.' });
  }

  try {
    targetAcode = decrypt(targetAcode); // raw

    const result = await pool.query(
      'DELETE FROM follows WHERE follower_acode = $1 AND following_acode = $2',
      [loggedInUser.acode, targetAcode]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Not following' });
    }

    res.json({ success: true, message: 'Unfollowed successfully' });
  } catch (err) {
    console.error('Error unfollowing artist:', err);
    res.status(500).json({ success: false, message: 'Failed to unfollow' });
  }
});


module.exports = router;