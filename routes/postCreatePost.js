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
const generatePostId = require('../middleware/generatePostId.js');
const upload = require('../middleware/multer-setup.js');


router.post('/create-post', upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 5 }
]), async (req, res) => {
  try {
    const { caption } = req.body;
    const acode = req.session.user?.acode;
    const post_id = generatePostId(20);
    const date = new Date();

    if (!acode) return res.status(401).json({ success: false, message: "Unauthorized" });

    const imageUrls = await Promise.all((req.files['images'] || []).map(file => uploadToS3(file, 'images/')));
    const videoUrls = await Promise.all((req.files['videos'] || []).map(file => uploadToS3(file, 'videos/')));

    await pool.query(`
      INSERT INTO posts (post_id, acode, image, track, video, caption, date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [post_id, acode, imageUrls, [], videoUrls, caption, date]);

    res.json({ success: true, message: "Post created!" });
  } catch (err) {
    console.error('Post creation error:', err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


module.exports = router;