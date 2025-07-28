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



router.get('/dashboard', compCheck, async (req, res) => {
  try {
    // Fetch plan, pfp_url, and acode of the current user
    const userResult = await pool.query(
      'SELECT plan, pfp_url, acode FROM users WHERE id = $1',
      [req.session.user.id]
    );

    const userRow = userResult.rows[0];
    const userPlan = userRow?.plan;

    if (!userPlan || userPlan === 'none') return res.redirect('/pricing');

    // Generate presigned URL for logged-in user's own profile pic
    let presignedPfpUrl;
    if (userRow?.pfp_url) {
      const filename = userRow.pfp_url.split('/').pop();
      presignedPfpUrl = await generatePresignedUrl(`pfp/${filename}`);
    } else {
      presignedPfpUrl = await generatePresignedUrl('drawables/banner_default.png');
    }

    // Fetch posts including poster's artist_name, username, acode, and pfp_url
    const postsResult = await pool.query(
  `SELECT p.*, u.username, u.artist_name, u.acode, u.pfp_url
   FROM posts p
   JOIN users u ON u.acode = p.acode
   WHERE p.acode = $1
      OR p.acode IN (
        SELECT following_acode
        FROM follows
        WHERE follower_acode = $1
      )
   ORDER BY p.date DESC`,
  [userRow.acode]
);


    const posts = await Promise.all(postsResult.rows.map(async post => {
      const images = post.image || [];
      const tracks = post.track || [];
      const videos = post.video || [];

      const presignedImages = await Promise.all(images.map(async img => {
        const filename = path.basename(img);
        return await generatePresignedUrl(`images/${filename}`);
      }));

      const presignedTracks = await Promise.all(tracks.map(async track => {
        const filename = path.basename(track);
        return await generatePresignedUrl(`audio/${filename}`);
      }));

      const presignedVideos = await Promise.all(videos.map(async video => {
        const filename = path.basename(video);
        return await generatePresignedUrl(`videos/${filename}`);
      }));

      // Generate presigned URL for poster's profile pic
      const presignedPosterPfpUrl = post.pfp_url
        ? await generatePresignedUrl(`pfp/${path.basename(post.pfp_url)}`)
        : await generatePresignedUrl('drawables/banner_default.png');

      return {
        post_id: post.post_id,
        acode: post.acode,  // for linking to profile
        caption: post.caption,
        images: presignedImages,
        tracks: presignedTracks,
        videos: presignedVideos,
        timeAgo: moment(post.date).fromNow(),
        displayName: post.artist_name?.trim() || post.username,
        posterPfpUrl: presignedPosterPfpUrl   // ✅ add poster's profile pic
      };
    }));

    
const isAjax = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest';

    res.render('dashboard', {
      layout: isAjax ? false : 'layout', // skip full layout for AJAX
      user: req.session.user,
      userAcode: userRow.acode,
      pfpUrl: presignedPfpUrl,
      posts
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Something went wrong.');
  }
});

module.exports = router;