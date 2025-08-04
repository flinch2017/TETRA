// routes/postRoutes.js
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
const app = express();


router.get('/media/:type/:filename', compCheck, async (req, res) => {
  const { type, filename } = req.params;

  // 1. Check if user is logged in and has an allowed plan
  const allowedPlans = ['basic', 'mid', 'pro'];
  if (!req.session.user || !allowedPlans.includes(req.session.user.plan)) {
    return res.status(403).send('Unauthorized');
  }

  // 2. Map type to your S3 folder names
  const folder = type === 'image' ? 'images' :
                 type === 'audio' ? 'audio' :
                 type === 'video' ? 'videos' : null;

  if (!folder) {
    return res.status(400).send('Invalid media type');
  }

  try {
    // 3. Generate a short-lived pre-signed URL (e.g., 1 minute)
    const url = await generatePresignedUrl(`${folder}/${filename}`, 60);

    // 4. Redirect the user to the S3 pre-signed URL
    res.redirect(url);
  } catch (err) {
    console.error('Error generating presigned URL:', err);
    res.status(500).send('Error generating media link');
  }
});

module.exports = router;