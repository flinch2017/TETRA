const pool = require('./db');
const moment = require('moment');
const path = require('path');
const generatePresignedUrl = require('./s3Presign');

function parsePgArray(input) {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input;
  }

  if (typeof input === 'string') {
    return input
      .replace(/^{|}$/g, '') // strip {}
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  return [];
}


async function getPostById(postId, viewerAcode) {
  const result = await pool.query(
    `SELECT post_id, acode, caption, image, track, video, date
     FROM posts
     WHERE post_id = $1`,
    [postId]
  );

  if (result.rows.length === 0) return null;

  const post = result.rows[0];

  const images = parsePgArray(post.image);
  const tracks = parsePgArray(post.track);
  const videos = parsePgArray(post.video);

  const presignedImages = await Promise.all(
    images.map(async (img) => {
      const filename = path.basename(img);
      return await generatePresignedUrl(`images/${filename}`);
    })
  );

  const presignedTracks = await Promise.all(
    tracks.map(async (track) => {
      const filename = path.basename(track);
      return await generatePresignedUrl(`audio/${filename}`);
    })
  );

  const presignedVideos = await Promise.all(
    videos.map(async (video) => {
      const filename = path.basename(video);
      return await generatePresignedUrl(`videos/${filename}`);
    })
  );

  // 🔍 Fetch post author's display name + pfp_url
  const authorResult = await pool.query(
    `SELECT COALESCE(artist_name, username) AS display_name, pfp_url
     FROM users
     WHERE acode = $1`,
    [post.acode]
  );

  const author = authorResult.rows[0] || {};
  let authorPfpUrl = null;

  if (author.pfp_url) {
    const filename = path.basename(author.pfp_url);
    authorPfpUrl = await generatePresignedUrl(`pfp/${filename}`);
  }

  // ❤️ Like count + viewer liked or not
  const likeResult = await pool.query(
    `SELECT COUNT(*) AS like_count,
            BOOL_OR(acode = $2) AS liked_by_viewer
     FROM post_likes
     WHERE post_id = $1`,
    [postId, viewerAcode]
  );

  const likeData = likeResult.rows[0];

  // 💬 Fetch comments
  const commentResult = await pool.query(
    `SELECT c.content, c.commented_at,
            COALESCE(u.artist_name, u.username) AS display_name,
            u.pfp_url
     FROM comments c
     JOIN users u ON u.acode = c.acode
     WHERE c.post_id = $1
     ORDER BY c.commented_at ASC`,
    [postId]
  );

  const comments = await Promise.all(commentResult.rows.map(async (c) => {
    let presignedPfp = null;
    if (c.pfp_url) {
      const filename = path.basename(c.pfp_url);
      presignedPfp = await generatePresignedUrl(`pfp/${filename}`);
    }

    return {
      username: c.display_name,
      content: c.content,
      pfp_url: presignedPfp,
      timeAgo: moment(c.commented_at).fromNow()
    };
  }));

  // 🔢 Total comment count
  const commentCountResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM comments WHERE post_id = $1`,
    [postId]
  );
  const commentCount = commentCountResult.rows[0].count;

  // ✅ Return final object
  return {
    post_id: post.post_id,
    acode: post.acode,
    caption: post.caption,
    images: presignedImages,
    tracks: presignedTracks,
    videos: presignedVideos,
    timeAgo: moment(post.date).fromNow(),
    likeCount: parseInt(likeData.like_count, 10),
    likedByViewer: likeData.liked_by_viewer || false,
    comments,
    commentCount,
    authorName: author.display_name || 'Unknown',
    authorPfpUrl
  };
}






module.exports = { getPostById };
