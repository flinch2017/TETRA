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

const { getPostById } = require('../utils/postService.js');



router.get('/post', compCheck, async (req, res) => {
  const postId = req.query.postId;

  


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



    const post = await getPostById(postId, userRow.acode);

   
    

    return res.render('postView', {
      
      user: req.session.user,
      userAcode: userRow.acode,
      pfpUrl: presignedPfpUrl,
      post
    });

  } catch (err) {
    console.error('Error fetching post:', err);
    return res.status(500).send('Server error');
  }
});

module.exports = router;