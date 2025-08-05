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


router.get('/artist/:acode/discography', compCheck, async (req, res) => {
  const encryptedAcode = req.params.acode;

  try {
    const decryptedAcode = decrypt(encryptedAcode); // 🔐 <-- Decrypt here


    const userResult = await pool.query(
      'SELECT plan, pfp_url, acode FROM users WHERE id = $1',
      [req.session.user.id]
    );

    const userRow = userResult.rows[0];
    const userPlan = userRow?.plan;

    if (!userPlan || userPlan === 'none') return res.redirect('/pricing');

    // ✅ Presigned PFP
    const presignedPfpUrl = userRow?.pfp_url
      ? await generatePresignedUrl(`pfp/${userRow.pfp_url.split('/').pop()}`)
      : await generatePresignedUrl('drawables/banner_default.png');

    // ✅ Get artist profile (now using decrypted acode)
    const artistResult = await pool.query(
      'SELECT artist_name, pfp_url AS avatar_url, bio FROM users WHERE acode = $1 LIMIT 1',
      [decryptedAcode]
    );

    if (artistResult.rowCount === 0) {
      return res.status(404).render('404');
    }

    const mainArtist = artistResult.rows[0];

    // ✅ Get releases
    const releasesResult = await pool.query(
      `SELECT release_id, acode, release_title, artwork_url, genre, explicit, upc, release_date, release_type
       FROM albums
       WHERE (',' || acode || ',') LIKE $1
       ORDER BY release_date DESC`,
      [`%,${decryptedAcode},%`]
    );

    const releases = releasesResult.rows;

    // ✅ Map all related artists
    const allAcodes = new Set();
    releases.forEach(release => {
      release.acode.split(',').forEach(code => allAcodes.add(code.trim()));
    });

    const usersResult = await pool.query(
      `SELECT acode, artist_name FROM users WHERE acode = ANY($1::text[])`,
      [[...allAcodes]]
    );

    const acodeToName = {};
    usersResult.rows.forEach(user => {
      acodeToName[user.acode] = user.artist_name;
    });

    const enrichedReleases = await Promise.all(
      releases.map(async release => {
        const artistNames = release.acode
          .split(',')
          .map(code => acodeToName[code.trim()])
          .filter(Boolean);

        const presignedArtwork = release.artwork_url
          ? await generatePresignedUrl(release.artwork_url)
          : null;

        return {
          release_id: release.release_id,
          title: release.release_title,
          releaseType: release.release_type,
          artists: artistNames,
          genre: release.genre,
          explicit: release.explicit,
          upc: release.upc,
          coverUrl: presignedArtwork,
          releasedOn: release.release_date
            ? moment(release.release_date).format('MMMM D, YYYY')
            : 'Unknown'
        };
      })
    );

    const artist = {
      name: mainArtist.artist_name,
      avatarUrl: mainArtist.avatar_url,
      bio: mainArtist.bio,
      releases: enrichedReleases
    };

    res.render('discography', { 
        userAcode: userRow.acode,
        pfpUrl: presignedPfpUrl,
        artist 
    });

  } catch (err) {
    console.error('Error loading discography:', err);
    res.status(500).send('Server error');
  }
});




module.exports = router;