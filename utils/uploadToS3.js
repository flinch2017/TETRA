// utils/uploadToS3.js
const fs = require('fs');
const path = require('path');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('./s3Client');

async function uploadToS3(file, folder = '') {
  const stream = fs.createReadStream(file.path);
  const key = `${folder}${file.filename}`;

  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: stream,
    ContentType: file.mimetype,
  }));

  fs.unlinkSync(file.path); // delete local file

  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

module.exports = uploadToS3;
