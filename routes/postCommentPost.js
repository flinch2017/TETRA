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

router.post('/api/posts/:postId/comment', compCheck, async (req, res) => {
  const { postId } = req.params;
  const { comment } = req.body;
  const acode = req.session.user?.acode;

  if (!acode) return res.status(401).json({ error: 'Unauthorized' });
  if (!comment?.trim()) return res.status(400).json({ error: 'Comment is empty' });

  try {
    const commentId = crypto.randomUUID();

    // Insert comment
    await pool.query(
      `INSERT INTO comments (comment_id, post_id, acode, content, commented_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [commentId, postId, acode, comment.trim()]
    );

    // Get display name and profile picture
const { rows } = await pool.query(
  `SELECT COALESCE(artist_name, username) AS display_name, pfp_url
   FROM users
   WHERE acode = $1`,
  [acode]
);
    const displayName = rows[0]?.display_name || 'You';

if (rows[0]?.pfp_url) {
  const filename = rows[0].pfp_url.split('/').pop();
  presignedPfpUrl = await generatePresignedUrl(`pfp/${filename}`);
} else {
  presignedPfpUrl = '/drawables/banner_default.png';
}


    // Send response with required data
    res.json({
      success: true,
      comment: comment.trim(),
      username: displayName,
      pfp_url: presignedPfpUrl,
      timeAgo: 'a few seconds ago' // Optional: calculate via moment or similar if desired
    });
  } catch (err) {
    console.error('Error posting comment:', err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});




module.exports = router;