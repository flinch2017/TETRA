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

router.post('/api/posts/:postId/like', async (req, res) => {
  const { postId } = req.params;
  const { liked } = req.body;
  const acode = req.session.user?.acode;

  if (!acode) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (liked) {
      await pool.query(
        `INSERT INTO post_likes (like_id, acode, post_id, liked_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (acode, post_id) DO NOTHING`,
        [crypto.randomUUID(), acode, postId]
      );
    } else {
      await pool.query(
        `DELETE FROM post_likes WHERE acode = $1 AND post_id = $2`,
        [acode, postId]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating post like status:', err);
    res.status(500).json({ success: false });
  }
});


module.exports = router;