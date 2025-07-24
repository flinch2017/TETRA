const pool = require('../utils/db'); // Adjust this if your pool connection is elsewhere
const generatePresignedUrl = require('../utils/s3Presign');

async function getHeaderPfpUrl(userId) {
  try {
    const { rows } = await pool.query(
      'SELECT pfp_url FROM users WHERE id = $1',
      [userId]
    );
    const user = rows[0] || {};

    if (user.pfp_url) {
      const filename = user.pfp_url.split('/').pop();
      return await generatePresignedUrl(`pfp/${filename}`);
    } else {
      return await generatePresignedUrl('drawables/banner_default.png');
    }
  } catch (err) {
    console.error('Error generating header PFP URL:', err);
    return '/path/to/fallback_pfp.png';
  }
}

module.exports = getHeaderPfpUrl;
