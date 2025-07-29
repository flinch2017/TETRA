const express = require('express');
const multer = require('multer');
const path = require('path');
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
const getHeaderPfpUrl = require('../middleware/getHeaderPfpUrl.js');


router.get('/profile', compCheck, async (req, res) => {
  const loggedInUser = req.session.user;
  const queryAcode = req.query.acode;
  let isOwnProfile = false;

  try {
    const targetAcode = queryAcode || loggedInUser.acode;
    isOwnProfile = (targetAcode === loggedInUser.acode);

    const headerPfpUrl = await getHeaderPfpUrl(loggedInUser.id);

    const { rows: userRows } = await pool.query(
      'SELECT account_mode, acode, pfp_url, artist_name, bio FROM users WHERE acode = $1',
      [targetAcode]
    );
    if (userRows.length === 0) {
      return res.status(404).render('profile', {
        artist: {
          name: loggedInUser.username || 'Unknown Artist',
          bannerUrl: '/path/to/default/banner.png',
          followers: '0',
          bio: '',
          account_mode: null,
          acode: null,
          songs: [],
          releases: []
        },
        pfpUrl: headerPfpUrl,
        userAcode: loggedInUser.acode,
        isOwnProfile,
        isFollowing: false,
        error: 'User not found.'
      });
    }

    const user = userRows[0];

    let bannerUrl = await generatePresignedUrl('drawables/banner_default.png');
    if (user.pfp_url) {
      const filename = user.pfp_url.split('/').pop();
      bannerUrl = await generatePresignedUrl(`pfp/${filename}`);
    }

    const encryptedAcode = encrypt(user.acode);

    const { rows: followerRows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM follows WHERE following_acode = $1',
      [user.acode]
    );
    const followerCount = followerRows[0]?.count || 0;

    let isFollowing = false;
    if (!isOwnProfile) {
      const followCheck = await pool.query(
        'SELECT 1 FROM follows WHERE follower_acode = $1 AND following_acode = $2',
        [loggedInUser.acode, user.acode]
      );
      isFollowing = followCheck.rowCount > 0;
    }

    const { rows: trackRows } = await pool.query(`
      SELECT 
        t.track_id, t.track_title, t.explicit,
        a.artwork_url,
        COALESCE(s.stream_count, 0) AS streams
      FROM tracks t
      INNER JOIN albums a ON t.release_id = a.release_id
      LEFT JOIN (
        SELECT track_id, COUNT(*)::int AS stream_count
        FROM streams WHERE verified = 'Yes'
        GROUP BY track_id
      ) s ON t.track_id = s.track_id
      WHERE 
        t.primary_artist ILIKE $1
        OR t.features ILIKE $1
      ORDER BY streams DESC
      LIMIT 10
    `, [`%${targetAcode}%`]);

    const likedResult = await pool.query(
      'SELECT track_id FROM likes WHERE acode = $1 AND track_id IS NOT NULL',
      [loggedInUser.acode]
    );
    const likedTrackIds = likedResult.rows.map(row => row.track_id);

    const songs = [];
    for (const track of trackRows) {
      let coverUrl = '/path/to/default_cover.jpg';
      if (track.artwork_url) {
        const filename = track.artwork_url.split('/').pop();
        coverUrl = await generatePresignedUrl(`artworks/${filename}`);
      }
      songs.push({
        id: track.track_id,
        title: track.track_title,
        coverUrl,
        streams: track.streams,
        explicit: track.explicit,
        isLiked: likedTrackIds.includes(track.track_id)
      });
    }

    const { rows: albumRows } = await pool.query(`
      SELECT release_id, release_title, artwork_url, release_date, explicit
      FROM albums
      WHERE acode ILIKE $1
      ORDER BY upload_date DESC
      LIMIT 5
    `, [`%${targetAcode}%`]);

    const releases = [];
    for (const album of albumRows) {
      let coverUrl = '/path/to/default_cover.jpg';
      if (album.artwork_url) {
        const filename = album.artwork_url.split('/').pop();
        coverUrl = await generatePresignedUrl(`artworks/${filename}`);
      }
      releases.push({
        id: album.release_id,
        title: album.release_title,
        coverUrl,
        releasedOn: album.release_date,
        explicit: album.explicit
      });
    }

    const { rows: monthlyListenerRows } = await pool.query(`
      SELECT COUNT(DISTINCT s.acode) AS listener_count
      FROM streams s
      JOIN tracks t ON s.track_id = t.track_id
      WHERE 
        (t.primary_artist = $1 OR t.features ILIKE $2)
        AND s.date >= date_trunc('month', CURRENT_DATE)
    `, [targetAcode, `%${targetAcode}%`]);

    const monthlyListeners = monthlyListenerRows[0]?.listener_count || 0;

    const { rows: rankRows } = await pool.query(`
      WITH artist_streams AS (
        SELECT s.acode AS listener, UNNEST(STRING_TO_ARRAY(t.primary_artist, ',')) AS artist_acode
        FROM streams s
        JOIN tracks t ON s.track_id = t.track_id
        WHERE s.date >= date_trunc('month', CURRENT_DATE)

        UNION ALL

        SELECT s.acode AS listener, UNNEST(STRING_TO_ARRAY(t.features, ',')) AS artist_acode
        FROM streams s
        JOIN tracks t ON s.track_id = t.track_id
        WHERE s.date >= date_trunc('month', CURRENT_DATE)
          AND t.features IS NOT NULL
      )
      SELECT TRIM(artist_acode) AS acode, COUNT(DISTINCT listener) AS listeners
      FROM artist_streams
      GROUP BY TRIM(artist_acode)
      ORDER BY listeners DESC
    `);

    let rank = null;
    for (let i = 0; i < rankRows.length; i++) {
      if (rankRows[i].acode === targetAcode) {
        rank = i + 1;
        break;
      }
    }

    const artist = {
      name: user.artist_name?.trim() || loggedInUser.username || 'Unknown Artist',
      bannerUrl,
      followers: followerCount,
      bio: user.bio?.trim() || '',
      account_mode: user.account_mode,
      acode: encryptedAcode,
      songs,
      releases,
      monthlyListeners,
      rank
    };

    res.render('profile', {
      artist,
      pfpUrl: headerPfpUrl,
      userAcode: loggedInUser.acode,
      isOwnProfile,
      isFollowing
    });

  } catch (err) {
    console.error('Error fetching profile data:', err);
    res.render('profile', {
      artist: {
        name: loggedInUser.username || 'Unknown Artist',
        bannerUrl: '/path/to/default/banner.png',
        followers: '0',
        bio: '',
        account_mode: null,
        acode: null,
        songs: [],
        releases: []
      },
      pfpUrl: '/path/to/default_pfp.png',
      userAcode: loggedInUser.acode,
      isOwnProfile,
      isFollowing: false,
      error: 'Failed to load profile.'
    });
  }
});


module.exports = router;