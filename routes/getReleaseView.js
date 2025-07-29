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


router.get('/album/:id', compCheck, async (req, res) => {
  const releaseId = req.params.id;
  const user = req.session.user;

  try {
    // ✅ Get current user's info
    const userResult = await pool.query(
      'SELECT plan, pfp_url, acode FROM users WHERE id = $1',
      [user.id]
    );

    const userRow = userResult.rows[0];
    if (!userRow || userRow.plan === 'none') {
      return res.redirect('/pricing');
    }

    // ✅ Generate presigned URL for profile picture
    let presignedPfpUrl;
    if (userRow.pfp_url) {
      const filename = userRow.pfp_url.split('/').pop();
      presignedPfpUrl = await generatePresignedUrl(`pfp/${filename}`);
    } else {
      presignedPfpUrl = await generatePresignedUrl('drawables/banner_default.png');
    }

    // ✅ Fetch album metadata
    const albumResult = await pool.query(
      `SELECT release_title, artwork_url, release_date, explicit, acode, release_type,
              genre, copyright, phonograph, record_label, deluxe,
              (
                SELECT COUNT(*) FROM streams s
                JOIN tracks t ON s.track_id = t.track_id
                WHERE t.release_id = $1
              ) AS total_streams
       FROM albums
       WHERE release_id = $1`,
      [releaseId]
    );

    if (albumResult.rowCount === 0) {
      return res.status(404).render('album', {
        album: null,
        error: 'Album not found.',
        userAcode: userRow.acode,
        pfpUrl: presignedPfpUrl
      });
    }

    const album = albumResult.rows[0];

    // ✅ Map album artist name
    const albumAcodeList = album.acode?.split(',').map(code => code.trim()) || [];
    let albumArtistName = '';

    if (albumAcodeList.length > 0) {
      const { rows: albumArtistRows } = await pool.query(
        `SELECT artist_name FROM users WHERE acode = ANY($1)`,
        [albumAcodeList]
      );
      albumArtistName = albumArtistRows.map(a => a.artist_name).join(', ');
    }

    // ✅ Generate artwork URL
    const coverUrl = album.artwork_url
      ? await generatePresignedUrl(`artworks/${album.artwork_url.split('/').pop()}`)
      : await generatePresignedUrl('drawables/disc_default.png');

    // ✅ Fetch tracks
    const trackResult = await pool.query(
      `SELECT track_id, track_title, explicit, primary_artist, features,
             genre, sub_genre, composer, producer, mood, deluxe
       FROM tracks
       WHERE release_id = $1
       ORDER BY track_order ASC`,
      [releaseId]
    );

    // ✅ Liked tracks
    const likedTracksResult = await pool.query(
      'SELECT track_id FROM likes WHERE acode = $1',
      [userRow.acode]
    );

    const likedTrackIds = likedTracksResult.rows.map(row => row.track_id);

    // ✅ Track stream counts
    const trackIds = trackResult.rows.map(row => row.track_id);
    const trackStreamsResult = await pool.query(
      `SELECT track_id, COUNT(*) as count FROM streams WHERE track_id = ANY($1::text[]) GROUP BY track_id`,
      [trackIds]
    );

    const streamCountMap = {};
    trackStreamsResult.rows.forEach(row => {
      streamCountMap[row.track_id] = parseInt(row.count);
    });

    // ✅ Assemble final track list with artist mapping
    const tracks = [];

    for (const track of trackResult.rows) {
      const primaryCodes = track.primary_artist?.split(',').map(c => c.trim()) || [];
      const featureCodes = track.features?.split(',').map(c => c.trim()) || [];

      let artistName = '';
      if (primaryCodes.length > 0) {
        const { rows: primaryNames } = await pool.query(
          `SELECT artist_name FROM users WHERE acode = ANY($1)`,
          [primaryCodes]
        );
        artistName += primaryNames.map(p => p.artist_name).join(', ');
      }

      if (featureCodes.length > 0) {
        const { rows: featureNames } = await pool.query(
          `SELECT artist_name FROM users WHERE acode = ANY($1)`,
          [featureCodes]
        );
        if (featureNames.length > 0) {
          artistName += ` feat. ${featureNames.map(f => f.artist_name).join(', ')}`;
        }
      }

      tracks.push({
        id: track.track_id,
        title: track.track_title,
        explicit: track.explicit,
        isLiked: likedTrackIds.includes(track.track_id),
        primary_artist: track.primary_artist,
        features: track.features,
        artist: artistName,
        genre: track.genre,
        sub_genre: track.sub_genre,
        composer: track.composer,
        producer: track.producer,
        mood: track.mood,
        deluxe: track.deluxe,
        streams: streamCountMap[track.track_id] || 0
      });
    }

    // ✅ Render album page
    res.render('album', {
      album: {
        id: releaseId,
        title: album.release_title,
        coverUrl,
        releasedOn: album.release_date,
        explicit: album.explicit,
        acode: album.acode,
        releaseType: album.release_type,
        genre: album.genre,
        copyright: album.copyright,
        phonograph: album.phonograph,
        recordLabel: album.record_label,
        deluxe: album.deluxe,
        totalStreams: album.total_streams,
        artist: albumArtistName,
        tracks
      },
      userAcode: userRow.acode,
      pfpUrl: presignedPfpUrl
    });

  } catch (err) {
    console.error('Error loading album page:', err);
    res.status(500).render('album', {
      album: null,
      error: 'Failed to load album.',
      userAcode: null,
      pfpUrl: null
    });
  }
});





module.exports = router;