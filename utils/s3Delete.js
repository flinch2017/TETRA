const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('./s3Client');

async function deleteFromS3(key) {
  if (!key) throw new Error('Missing S3 key');
  
  return await s3.send(new DeleteObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key
  }));
}

module.exports = deleteFromS3;
