const express = require('express');
const multer = require('multer');
const path = require('path');
const uploadToS3 = require('../utils/uploadToS3');
const { encrypt, decrypt } = require('../utils/encryption.js');
const pool = require('../utils/db');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const router = express.Router();
const moment = require('moment');
const paypal = require('@paypal/checkout-server-sdk');
const generatePresignedUrl = require('../utils/s3Presign');
const uploadTrackToS3 = require('../utils/uploadTrackToS3');
const deleteFromS3 = require('../utils/s3Delete');
const uploadArtworkToS3 = require('../utils/uploadArtworkToS3');
const uploadCanvasToS3 = require('../utils/uploadCanvasToS3');
const compCheck = require('../middleware/compCheck.js');
const upload = require('../middleware/multer-setup.js');

router.post('/submit-release', upload.any(), async (req, res) => {
  try {
    const {
      release_id, release_title, genre, explicit,
      upc, copyright, phonograph, record_label,
      release_date, release_time, release_zone, track_order, release_type
    } = req.body;

    const artFile = req.files.find(f => f.fieldname === 'art_url') || null;
    const canvasFile = req.files.find(f => f.fieldname === 'canvas_url') || null;

    let artKey = null, canvasKey = null;
    if (artFile) artKey = await uploadArtworkToS3(artFile, release_id);
    if (canvasFile) canvasKey = await uploadCanvasToS3(canvasFile, release_id);

    // Parse tracks
    let tracks = [];
    if (req.body.tracks) {
      try {
        tracks = JSON.parse(req.body.tracks);
      } catch (e) {
        console.error('Could not parse tracks JSON:', e);
      }
    }

    // === Build acode logic here ===
    let albumAcodesSet = new Set();

    if (tracks.length === 1) {
      const track = tracks[0];
      const primary = (track.primaryArtistAcodes || '').split(',').map(a => a.trim());
      const features = (track.featuredArtistAcodes || '').split(',').map(a => a.trim());
      [...primary, ...features].forEach(acode => {
        if (acode) albumAcodesSet.add(acode);
      });
    } else if (tracks.length > 1) {
      let commonPrimary = null;
      for (const track of tracks) {
        const primaries = new Set((track.primaryArtistAcodes || '').split(',').map(a => a.trim()).filter(Boolean));
        if (!commonPrimary) {
          commonPrimary = primaries;
        } else {
          commonPrimary = new Set([...commonPrimary].filter(a => primaries.has(a)));
        }
      }
      if (commonPrimary) {
        commonPrimary.forEach(a => albumAcodesSet.add(a));
      }
    }

    const albumAcodes = [...albumAcodesSet].join(',') || null;

    // Insert into albums
    await pool.query(`
      INSERT INTO albums
      (release_id, acode, release_title, artwork_url, canvas_url, genre, explicit, upc, tracks,
       copyright, phonograph, record_label, release_date, release_time, release_zone, release_type)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    `, [
      release_id || null,
      albumAcodes,
      release_title || null,
      artKey,
      canvasKey,
      genre || null,
      explicit || null,
      upc || null,
      track_order || null,
      copyright || null,
      phonograph || null,
      record_label || null,
      release_date || null,
      release_time || null,
      release_zone || null,
      release_type || null
    ]);

    // Track order array
    const trackOrderArray = (track_order || '').split(',');

    for (const track of tracks) {
      if (!track.trackId || !track.s3Key) continue;

      let orderIndex = trackOrderArray.indexOf(track.trackId);
      if (orderIndex === -1) orderIndex = 0;

      await pool.query(`
        INSERT INTO tracks 
        (track_id, release_id, acode, track_title, primary_artist, features, audio_url,
         genre, sub_genre, composer, producer, mood, isrc, track_order, release_date, bpm, explicit)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      `, [
        track.trackId || null,
        release_id || null,
        albumAcodes,
        track.title?.trim() || null,
        track.primaryArtistAcodes?.trim() || null,
        track.featuredArtistAcodes?.trim() || null,
        track.s3Key || null,
        track.genre?.trim() || null,
        track.subGenre?.trim() || null,
        track.composer?.trim() || null,
        track.producer?.trim() || null,
        track.mood?.trim() || null,
        track.isrc?.trim() || null,
        orderIndex + 1,
        release_date || null,
        track.bpm?.trim() || null,
        track.explicit?.trim() || null
      ]);
    }

    res.json({ success: true, message: 'Release created successfully!' });
  } catch (err) {
    console.error('Error submitting release:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



module.exports = router;