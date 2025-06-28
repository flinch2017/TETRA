// utils/uploadToS3.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('./s3Client');

async function uploadToS3(file, folder = '') {
  const originalPath = file.path;
  const ext = path.extname(file.originalname).toLowerCase(); // .jpg, .png etc
  const compressedFilename = `compressed-${Date.now()}-${file.filename}`;
  const compressedPath = path.join(path.dirname(originalPath), compressedFilename);

  try {
    // Compress image: resize to max 1200px width, keep aspect ratio, quality ~80%
    await sharp(originalPath)
      .resize({ width: 1200, withoutEnlargement: true })
      .toFormat(ext === '.png' ? 'png' : 'jpeg', { quality: 80 })
      .toFile(compressedPath);

    // Upload compressed file to S3
    const compressedStream = fs.createReadStream(compressedPath);
    const key = `${folder}${compressedFilename}`;

    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: compressedStream,
      ContentType: file.mimetype
    }));

    // Clean up: delete local original & compressed files
    await fs.promises.unlink(originalPath).catch(err => console.warn('Could not delete original file:', err));
    await fs.promises.unlink(compressedPath).catch(err => console.warn('Could not delete compressed file:', err));

    // Return public URL
    return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  } catch (err) {
    console.error('Error compressing or uploading to S3:', err);
    // Attempt cleanup
    await fs.promises.unlink(originalPath).catch(() => {});
    await fs.promises.unlink(compressedPath).catch(() => {});
    throw err; // re-throw so route knows it failed
  }
}

module.exports = uploadToS3;
