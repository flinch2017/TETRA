const express = require('express');
const router = express.Router();
const s3 = require('../utils/s3Client');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Route for /drawables/:filename
router.get('/drawables/:filename', async (req, res) => {
  const { filename } = req.params;

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `drawables/${filename}`, // 💡 prepend "drawables/"
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 });
    res.redirect(signedUrl);
  } catch (err) {
    console.error('Error fetching S3 drawable:', err);
    res.status(404).send('Image not found');
  }
});

module.exports = router;
