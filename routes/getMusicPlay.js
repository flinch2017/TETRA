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
  const viewer_acode = req.session?.user?.acode;

  try {
    // Fetch song info including primary artist, features, artwork, and canvas
    const result = await pool.query(`
      SELECT 
        t.track_title AS title, 
        t.primary_artist, 
        t.features, 
        a.artwork_url AS "coverUrl", 
        a.canvas_url,
        t.audio_url,
        t.acode,
        t.release_id
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

    // Get feature artist names
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

    // Generate presigned URL for cover artwork
    let coverUrl = null;
    if (song.coverUrl) {
      try {
        coverUrl = await generatePresignedUrl(song.coverUrl);
      } catch (err) {
        console.warn(`Failed to generate presigned URL for artwork:`, err);
      }
    }

    // Generate presigned URL for canvas
    let canvasUrl = null;
    if (song.canvas_url) {
      try {
        canvasUrl = await generatePresignedUrl(song.canvas_url);
      } catch (err) {
        console.warn(`Failed to generate presigned URL for canvas:`, err);
      }
    }

    // Combine artist names
    const artistString = featureNames.length > 0
      ? `${primaryArtistNames.join(', ')} feat. ${featureNames.join(', ')}`
      : primaryArtistNames.join(', ');

    // Check if track is liked by the current user
    let liked = false;
    if (viewer_acode) {
      const likeResult = await pool.query(
        `SELECT 1 FROM likes WHERE acode = $1 AND track_id = $2 LIMIT 1`,
        [viewer_acode, songId]
      );
      liked = likeResult.rows.length > 0;
    }

    // Overwrite old entry in recents with new one
    if (viewer_acode) {
      await pool.query(`
        DELETE FROM recents 
        WHERE owner_acode = $1 AND track_id = $2
      `, [viewer_acode, songId]);

      await pool.query(`
        INSERT INTO recents (recent_id, viewed_acode, release_id, track_id, owner_acode, accessed_time)
        VALUES ($1, $2, $3, $4, $5, NOW()::text)
      `, [
        crypto.randomUUID(),
        song.acode,
        song.release_id,
        songId,
        viewer_acode
      ]);
    }

    // Return JSON response
    res.json({
      track_id: songId,
      title: song.title,
      artist: artistString,
      coverUrl,
      audioUrl,
      canvasUrl,
      isLiked: liked
    });

  } catch (err) {
    console.error('Error fetching song info:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});




module.exports = router;