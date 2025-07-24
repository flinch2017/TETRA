const express = require('express');
const multer = require('multer');

const uploadToS3 = require('../utils/uploadToS3');
const { encrypt, decrypt } = require('../utils/encryption.js');
const pool = require('../utils/db');
const crypto = require('crypto');

const router = express.Router();
const moment = require('moment');

const generatePresignedUrl = require('../utils/s3Presign');
const uploadTrackToS3 = require('../utils/uploadTrackToS3');
const deleteFromS3 = require('../utils/s3Delete');
const uploadArtworkToS3 = require('../utils/uploadArtworkToS3');
const uploadCanvasToS3 = require('../utils/uploadCanvasToS3');
const compCheck = require('../middleware/compCheck.js');

router.get('/api/song-info/:id', async (req, res) => {
  const songId = req.params.id;

  try {
    // Fetch song info including primary artist, features, and artwork
    const result = await pool.query(`
      SELECT 
        t.track_title AS title, 
        t.primary_artist, 
        t.features, 
        a.artwork_url AS "coverUrl", 
        t.audio_url
      FROM tracks t
      JOIN albums a ON t.release_id = a.release_id
      WHERE t.track_id = $1
    `, [songId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Song not found' });
    }

    const song = result.rows[0];

    // Get primary artist names
    let primaryArtistNames = [];
    if (song.primary_artist) {
      const primaryCodes = song.primary_artist.split(',').map(code => code.trim());
      if (primaryCodes.length > 0) {
        const primaryResult = await pool.query(
          `SELECT artist_name FROM users WHERE acode = ANY($1)`,
          [primaryCodes]
        );
        primaryArtistNames = primaryResult.rows.map(r => r.artist_name);
      }
    }

    // Get feature names
    let featureNames = [];
    if (song.features) {
      const featureCodes = song.features.split(',').map(code => code.trim());
      if (featureCodes.length > 0) {
        const featureResult = await pool.query(
          `SELECT artist_name FROM users WHERE acode = ANY($1)`,
          [featureCodes]
        );
        featureNames = featureResult.rows.map(r => r.artist_name);
      }
    }

    // Generate presigned URL for audio
    let audioUrl = null;
    if (song.audio_url) {
      try {
        audioUrl = await generatePresignedUrl(song.audio_url);
      } catch (err) {
        console.warn(`Failed to generate presigned URL for audio:`, err);
      }
    }

    // Generate presigned URL for artwork
    let coverUrl = null;
    if (song.coverUrl) {
      try {
        coverUrl = await generatePresignedUrl(song.coverUrl);
      } catch (err) {
        console.warn(`Failed to generate presigned URL for artwork:`, err);
      }
    }

    const artistString =
      featureNames.length > 0
        ? `${primaryArtistNames.join(', ')} feat. ${featureNames.join(', ')}`
        : primaryArtistNames.join(', ');

    res.json({
      title: song.title,
      artist: artistString,
      coverUrl,
      audioUrl
    });

  } catch (err) {
    console.error('Error fetching song info:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


module.exports = router;