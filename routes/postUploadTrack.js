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

router.post('/upload-track', compCheck, upload.single('track'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No track uploaded' });

    const { releaseId, trackId } = req.body;
    if (!releaseId || !trackId) {
      return res.status(400).json({ success: false, message: 'Missing releaseId or trackId' });
    }

    const s3Key = await uploadTrackToS3(req.file, releaseId, trackId, 'tracks/');

    // Generate presigned URL to preview
    const url = await generatePresignedUrl(s3Key, 3600);

    res.json({ success: true, key: s3Key, url, trackId });
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

module.exports = router;