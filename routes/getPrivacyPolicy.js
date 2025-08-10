const express = require('express');
const multer = require('multer');
const uploadToS3 = require('../utils/uploadToS3');
const { encrypt, decrypt } = require('../utils/encryption.js');
const pool = require('../utils/db');



const router = express.Router();
const moment = require('moment');

const generatePresignedUrl = require('../utils/s3Presign');
const uploadTrackToS3 = require('../utils/uploadTrackToS3');
const deleteFromS3 = require('../utils/s3Delete');
const uploadArtworkToS3 = require('../utils/uploadArtworkToS3');
const uploadCanvasToS3 = require('../utils/uploadCanvasToS3');
const compCheck = require('../middleware/compCheck.js');
const path = require('path');

const expressLayouts = require('express-ejs-layouts');


router.get('/privacy-policy', (req, res) => {
  res.render('privacyPolicy', {
    siteName: 'TETRA METROPOLIS',
    siteUrl: 'https://tetrometro.com',
    effectiveDate: 'August 10, 2025',
    lastUpdated: 'August 10, 2025',
    supportEmail: 'support@tetrometro.com'
  });
});

module.exports = router;
