// utils/uploadArtworkToS3.js
const fs = require('fs');
const path = require('path');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('./s3Client');

async function uploadArtworkToS3(file, releaseId) {
  const filePath = file.path;
  const key = `artworks/${releaseId}-${file.originalname.replace(/\s+/g, '_')}`;

  try {
    const stream = fs.createReadStream(filePath);
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: stream,
      ContentType: file.mimetype
    }));

    await fs.promises.unlink(filePath).catch(err => console.warn('Could not delete local file:', err));

    return key;
  } catch (err) {
    console.error('Error uploading artwork to S3:', err);
    await fs.promises.unlink(filePath).catch(() => {});
    throw err;
  }
}

module.exports = uploadArtworkToS3;
