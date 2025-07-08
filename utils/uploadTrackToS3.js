// utils/uploadTrackToS3.js
const fs = require('fs');
const path = require('path');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('./s3Client');

async function uploadTrackToS3(file, folder = 'tracks/') {
  const filePath = file.path;
  const key = `${folder}${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;

  try {
    const stream = fs.createReadStream(filePath);

    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: stream,
      ContentType: file.mimetype
    }));

    // Delete local temp file
    await fs.promises.unlink(filePath).catch(err => console.warn('Could not delete local file:', err));

    // Return S3 key so you can build URL or presigned URL
    return key;
  } catch (err) {
    console.error('Error uploading track to S3:', err);
    await fs.promises.unlink(filePath).catch(() => {});
    throw err;
  }
}

module.exports = uploadTrackToS3;
