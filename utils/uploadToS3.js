// utils/uploadToS3.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('./s3Client');

async function uploadToS3(file, folder = '', prefix = '') {
  const originalPath = file.path;
  const ext = path.extname(file.originalname).toLowerCase(); // .jpg, .png etc
  const baseFilename = `compressed-${Date.now()}-${file.filename}`;
  const filenameWithPrefix = prefix ? `${prefix}-${baseFilename}` : baseFilename;
  const compressedPath = path.join(path.dirname(originalPath), filenameWithPrefix);

  try {
    // Compress image
    await sharp(originalPath)
      .resize({ width: 1200, withoutEnlargement: true })
      .toFormat(ext === '.png' ? 'png' : 'jpeg', { quality: 80 })
      .toFile(compressedPath);

    const compressedStream = fs.createReadStream(compressedPath);
    const key = `${folder}${filenameWithPrefix}`;

    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: compressedStream,
      ContentType: file.mimetype
    }));

    // Clean up
    await fs.promises.unlink(originalPath).catch(err => console.warn('Could not delete original file:', err));
    await fs.promises.unlink(compressedPath).catch(err => console.warn('Could not delete compressed file:', err));

    return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  } catch (err) {
    console.error('Error compressing or uploading to S3:', err);
    await fs.promises.unlink(originalPath).catch(() => {});
    await fs.promises.unlink(compressedPath).catch(() => {});
    throw err;
  }
}

module.exports = uploadToS3;

