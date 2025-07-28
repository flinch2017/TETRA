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



router.get('/music', compCheck, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Get current user's info
    const userResult = await pool.query(
      'SELECT plan, pfp_url, acode FROM users WHERE id = $1',
      [userId]
    );

    const userRow = userResult.rows[0];
    if (!userRow || userRow.plan === 'none') {
      return res.redirect('/pricing');
    }

    // Generate presigned URL for user's profile picture
    let presignedPfpUrl;
    if (userRow.pfp_url) {
      const filename = userRow.pfp_url.split('/').pop();
      presignedPfpUrl = await generatePresignedUrl(`pfp/${filename}`);
    } else {
      presignedPfpUrl = await generatePresignedUrl('drawables/banner_default.png');
    }

    // ---------- Dynamic Promotional Posts from Followed Artists ----------

// 1. Get all artists the user follows
const { rows: followedRows } = await pool.query(
  `SELECT following_acode FROM follows WHERE follower_acode = $1`,
  [userRow.acode]
);

// 2. Include the current user's own acode
const followedAcodes = [...new Set([
  ...followedRows.map(row => row.following_acode),
  userRow.acode
])];

let promotionalPosts = [];

if (followedAcodes.length > 0) {
  // 3. Fetch recent albums that match any followed or own acode
  const { rows: albumRows } = await pool.query(`
    SELECT release_id, release_title, artwork_url, release_date, explicit, acode
    FROM albums
    WHERE EXISTS (
      SELECT 1 FROM unnest(string_to_array(acode, ',')) AS a
      WHERE a = ANY($1::text[])
    )
    ORDER BY upload_date DESC
    LIMIT 10
  `, [followedAcodes]);

  for (const album of albumRows) {
    let coverUrl = await generatePresignedUrl('drawables/disc_default.png');
    if (album.artwork_url) {
      const filename = album.artwork_url.split('/').pop();
      coverUrl = await generatePresignedUrl(`artworks/${filename}`);
    }

    let artistName = 'Unknown Artist';

    if (album.acode) {
      const acodeArray = album.acode.split(',').map(a => a.trim()).filter(Boolean);

      const { rows: artistRows } = await pool.query(
        `SELECT artist_name FROM users WHERE acode = ANY($1::text[])`,
        [acodeArray]
      );

      if (artistRows.length > 0) {
        artistName = artistRows.map(a => a.artist_name).join(', ');
      }
    }

    promotionalPosts.push({
      id: album.release_id,
      title: album.release_title,
      artist: artistName,
      acode: album.acode,
      coverUrl
    });
  }
}




    // ---------- Other Static Sections ----------
    const recentTracks = [
      {
        title: 'Night Drive',
        artist: 'SynthNova',
        acode: 'A2001',
        coverUrl: await generatePresignedUrl('drawables/disc_default.png'),
        audioUrl: '/static/audio/sample1.mp3'
      }
    ];

    const playlists = [
      {
        name: 'Mood Booster',
        playlist_id: 101,
        coverUrl: await generatePresignedUrl('drawables/disc_default.png'),
        track_count: 25
      },
      {
        name: 'Chill Vibes',
        playlist_id: 102,
        coverUrl: await generatePresignedUrl('drawables/disc_default.png'),
        track_count: 40
      }
    ];

    const topVideos = [
      {
        title: 'Live at the Arena',
        artist: 'StageFire',
        acode: 'A3001',
        thumbnail: '/static/images/thumb1.jpg'
      },
      {
        title: 'Behind the Scenes',
        artist: 'BackRoom',
        acode: 'A3002',
        thumbnail: '/static/images/thumb2.jpg'
      }
    ];

    // ---------- Render Page ----------
    const isAjax = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest';
    res.render('music', {
      layout: isAjax ? false : 'layout',
      user: req.session.user,
      userAcode: userRow.acode,
      pfpUrl: presignedPfpUrl,
      promotionalPosts,
      recentTracks,
      playlists,
      topVideos
    });

  } catch (err) {
    console.error('Music dashboard error:', err);
    res.status(500).send('Something went wrong.');
  }
});



module.exports = router;