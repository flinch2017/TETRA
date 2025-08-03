const express = require('express');
const pool = require('../utils/db');
const router = express.Router();
const getHeaderPfpUrl = require('../middleware/getHeaderPfpUrl.js');
const generatePresignedUrl = require('../utils/s3Presign');

const S3_BASE = 'https://tetrametropolis.s3.us-east-1.amazonaws.com/';

function isFullUrl(url) {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
}

function toS3Key(url) {
  if (!url) return null;
  if (url.startsWith(S3_BASE)) return url.replace(S3_BASE, '');
  return isFullUrl(url) ? null : url;
}

router.get('/search', async (req, res) => {
  const loggedInUser = req.session.user;
  const query = req.query.q?.trim();

  if (!query) {
    return res.render('search_results', {
      pfpUrl: null,
      userAcode: loggedInUser?.acode || null,
      artists: [],
      songs: [],
      albums: [],
      posts: [],
      query: ''
    });
  }

  try {
    const headerPfpUrl = await getHeaderPfpUrl(loggedInUser.id);
    const likeQuery = `%${query}%`;

    const [artistRes, trackRes, albumRes] = await Promise.all([
      pool.query(
        `SELECT id, acode, pfp_url, COALESCE(artist_name, username) AS display_name
         FROM users
         WHERE artist_name ILIKE $1 OR username ILIKE $1
         LIMIT 20`,
        [likeQuery]
      ),
      pool.query(
        `SELECT track_id, track_title, primary_artist, features, release_id
         FROM tracks
         WHERE track_title ILIKE $1
         LIMIT 20`,
        [likeQuery]
      ),
      pool.query(
        `SELECT release_id, release_title, artwork_url, acode
         FROM albums
         WHERE release_title ILIKE $1
         LIMIT 20`,
        [likeQuery]
      )
    ]);

    const artistAcodes = artistRes.rows.map(a => a.acode);
    const artistLikePatterns = artistAcodes.map(code => `%${code}%`);

    const extraTracksFromArtist = artistAcodes.length
      ? await pool.query(
          `SELECT track_id, track_title, primary_artist, features, release_id
           FROM tracks
           WHERE primary_artist ILIKE ANY ($1) OR features ILIKE ANY ($1)
           LIMIT 30`,
          [artistLikePatterns]
        )
      : { rows: [] };

    const extraAlbumsFromArtist = artistAcodes.length
      ? await pool.query(
          `SELECT release_id, release_title, artwork_url, acode
           FROM albums
           WHERE acode ILIKE ANY ($1)
           LIMIT 30`,
          [artistLikePatterns]
        )
      : { rows: [] };

    const matchedUserRes = await pool.query(
      `SELECT acode FROM users WHERE artist_name ILIKE $1 OR username ILIKE $1`,
      [likeQuery]
    );
    const matchedAcodes = matchedUserRes.rows.map(u => u.acode);

    const relevantPostRes = await pool.query(
      `SELECT p.post_id, p.caption, p.image, p.date,
              COALESCE(u.artist_name, u.username) AS username,
              u.pfp_url AS authorPfpUrl
       FROM posts p
       JOIN users u ON p.acode = u.acode
       WHERE p.caption ILIKE $1 OR p.acode = ANY ($2)
       ORDER BY p.date DESC
       LIMIT 40`,
      [likeQuery, matchedAcodes]
    );

    const postIds = relevantPostRes.rows.map(p => p.post_id);

// Fetch like counts and user liked status
const [likeCountsRes, userLikesRes, commentCountsRes] = await Promise.all([
  pool.query(
    `SELECT post_id, COUNT(*) AS like_count
     FROM post_likes
     WHERE post_id = ANY($1)
     GROUP BY post_id`,
    [postIds]
  ),
  pool.query(
    `SELECT post_id
     FROM post_likes
     WHERE post_id = ANY($1) AND acode = $2`,
    [postIds, loggedInUser.acode]
  ),
  pool.query(
    `SELECT post_id, COUNT(*) AS comment_count
     FROM comments
     WHERE post_id = ANY($1)
     GROUP BY post_id`,
    [postIds]
  )
]);

// Convert to lookup maps
const likeCountMap = Object.fromEntries(likeCountsRes.rows.map(r => [r.post_id, parseInt(r.like_count)]));
const commentCountMap = Object.fromEntries(commentCountsRes.rows.map(r => [r.post_id, parseInt(r.comment_count)]));
const userLikedSet = new Set(userLikesRes.rows.map(r => r.post_id));


    const combinedTracks = [...trackRes.rows, ...extraTracksFromArtist.rows];
    const combinedAlbums = [...albumRes.rows, ...extraAlbumsFromArtist.rows];

    const allTrackReleaseIds = Array.from(
      new Set(combinedTracks.map(t => t.release_id).filter(Boolean))
    );

    const albumArtRes = await pool.query(
      `SELECT release_id, artwork_url FROM albums WHERE release_id = ANY($1)`,
      [allTrackReleaseIds]
    );

    const albumArtworkMap = {};
    for (const row of albumArtRes.rows) {
      const key = toS3Key(row.artwork_url);
      albumArtworkMap[row.release_id] = key
        ? await generatePresignedUrl(key)
        : isFullUrl(row.artwork_url) ? row.artwork_url : null;
    }

    const allTrackAcodes = new Set();
    combinedTracks.forEach(track => {
      track.primary_artist?.split(',').forEach(code => allTrackAcodes.add(code.trim()));
      track.features?.split(',').forEach(code => allTrackAcodes.add(code.trim()));
    });

    const trackArtistRes = await pool.query(
      `SELECT acode, COALESCE(artist_name, username) AS name FROM users WHERE acode = ANY($1)`,
      [[...allTrackAcodes]]
    );
    const artistNameMap = Object.fromEntries(trackArtistRes.rows.map(row => [row.acode, row.name]));

    const trackRows = combinedTracks.map(track => {
  const primary = (track.primary_artist || '').split(',').map(a => artistNameMap[a?.trim()]).filter(Boolean);
  const features = (track.features || '').split(',').map(a => artistNameMap[a?.trim()]).filter(Boolean);
  const artistName = features.length > 0
    ? `${primary.join(', ')} feat. ${features.join(', ')}`
    : primary.join(', ');

  return {
    track_id: track.track_id, // ✅ Include this line
    title: track.track_title,
    artistName,
    coverUrl: albumArtworkMap[track.release_id] || null
  };
});


    const albumAcodes = new Set();
    combinedAlbums.forEach(album => {
      album.acode?.split(',').forEach(a => albumAcodes.add(a.trim()));
    });

    const albumArtistRes = await pool.query(
      `SELECT acode, COALESCE(artist_name, username) AS name FROM users WHERE acode = ANY($1)`,
      [[...albumAcodes]]
    );
    const albumArtistMap = Object.fromEntries(albumArtistRes.rows.map(row => [row.acode, row.name]));

    const albumRows = await Promise.all(combinedAlbums.map(async album => {
      const acodes = album.acode?.split(',').map(a => a.trim()) || [];
      const artistNames = acodes.map(a => albumArtistMap[a]).filter(Boolean);
      const key = toS3Key(album.artwork_url);
      const coverUrl = key
        ? await generatePresignedUrl(key)
        : isFullUrl(album.artwork_url) ? album.artwork_url : null;
      return {
        title: album.release_title,
        artistName: artistNames.join(', '),
        release_id: album.release_id,
        coverUrl
      };
    }));

    const artistRows = await Promise.all(artistRes.rows.map(async artist => {
      const key = toS3Key(artist.pfp_url);
      const signedPfp = key
        ? await generatePresignedUrl(key)
        : isFullUrl(artist.pfp_url) ? artist.pfp_url : await generatePresignedUrl('drawables/pfp_default.png');
      return {
        ...artist,
        pfp_url: signedPfp
      };
    }));

    const postRows = await Promise.all(relevantPostRes.rows.map(async post => {

        const likeCount = likeCountMap[post.post_id] || 0;
const commentCount = commentCountMap[post.post_id] || 0;
const likedByUser = userLikedSet.has(post.post_id);


      let images = [];

        if (Array.isArray(post.image)) {
        images = post.image;
        } else if (typeof post.image === 'string') {
        try {
            const parsed = JSON.parse(post.image);
            images = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            images = post.image.includes(',') ? post.image.split(',') : [post.image];
        }
        }


      const signedImages = await Promise.all(
        images.map(async img => {
          const key = toS3Key(img.trim());
          return key
            ? await generatePresignedUrl(key)
            : isFullUrl(img) ? img : null;
        })
      );

      const pfpKey = toS3Key(post.authorpfpurl);
      const signedPfp = pfpKey
        ? await generatePresignedUrl(pfpKey)
        : isFullUrl(post.authorpfpurl) ? post.authorpfpurl : await generatePresignedUrl('drawables/pfp_default.png');

      return {
  ...post,
  authorPfpUrl: signedPfp,
  images: signedImages,
  likeCount,
  commentCount,
   isLiked: userLikedSet.has(post.post_id), // 👈 rename it here
  formattedDate: new Date(post.date).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
};


      
    }));

    res.render('search_results', {
      pfpUrl: headerPfpUrl,
      userAcode: loggedInUser.acode,
      artists: artistRows,
      songs: trackRows,
      albums: albumRows,
      posts: postRows,
      query
    });

  } catch (err) {
    console.error('Search error:', err);
    res.status(500).render('error', { message: 'Something went wrong during search.' });
  }
});

module.exports = router;
