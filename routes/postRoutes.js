// routes/postRoutes.js
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

let environment = new paypal.core.SandboxEnvironment(
  "AZ3vwRr1sqKm0Fm3jQAP8nkMmkCjaYvGxuSYRBaNvfRNOGSdqAJ_xUXKkn8go9a8eS7oegV6lSFkYorj",
  "ECDyl6qPiT5vgCFu0VlDHPZWNTj_4aivacNjo02gNjT63dzvTHeomI6r5IO6v07dExweU1pX6V3gNucb"
);

const client = new paypal.core.PayPalHttpClient(environment);


// temp local storage with multer
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2)}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ storage });

async function compCheck(req, res, next) {
  try {
    if (!req.session.user || !req.session.user.acode) {
      // Not logged in
      return res.redirect('/login');
    }

    // Query user from DB to check plan
    const result = await pool.query('SELECT plan FROM users WHERE acode = $1', [req.session.user.acode]);

    if (result.rows.length === 0) {
      // User not found in DB — redirect to login or error
      return res.redirect('/login');
    }

    const userPlan = result.rows[0].plan;

    if (!userPlan) {
      // Plan is null or missing, restrict access
      return res.redirect('/pricing');
    }

    // User has a plan, proceed
    next();

  } catch (err) {
    console.error('Error checking user plan:', err);
    res.status(500).send('Internal Server Error');
  }
}

function generatePostId(length = 20) {
  return crypto.randomBytes(30).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, length);
}





// Routes
router.get('/', (req, res) => {
  res.render('welcome', { appName: 'TETRA' });
});

router.get('/signup', (req, res) => {
  res.render('signup', { error: '' });
});

router.get('/login', (req, res) => {
  res.render('login');
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      return res.render('login', { error: 'All fields are required.' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (userResult.rowCount === 0) {
      return res.render('login', { error: 'Username not found.' });
    }

    const user = userResult.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.render('login', { error: 'Incorrect password.' });
    }

    if (!user.verified) {
      return res.redirect(`/auth?email=${encodeURIComponent(user.email)}`);
    }

    // Create session
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      acode: user.acode,
      plan: user.plan
    };

    // Check if the user has not subscribed to a plan
if (!user.plan || user.plan === 'none') {
  return res.redirect('/pricing');
}


    // Otherwise, go to dashboard
    res.redirect('/dashboard');
    
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { error: 'Internal server error. Please try again later.' });
  }
});




router.get('/auth', (req, res) => {
  const email = req.query.email; // safely extract email from URL query
  res.render('auth', { email, error: null });
});


router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    // Basic validation
    if (!username || !email || !password || !confirmPassword) {
      return res.render('signup', { error: 'All fields are required.' });
    }

    // Username validation: lowercase letters, numbers, or allowed symbols, no spaces
    // Adjust the allowed symbols as needed. Here I allow underscore, hyphen, and dot:
    const usernameRegex = /^[a-z0-9._-]+$/;
    if (!usernameRegex.test(username)) {
      return res.render('signup', {
        error:
          'Username can only contain lowercase letters, numbers, and symbols (._-), and no spaces.'
      });
    }

    if (password !== confirmPassword) {
      return res.render('signup', { error: 'Passwords do not match.' });
    }
    if (password.length < 8) {
      return res.render('signup', { error: 'Password must be at least 8 characters.' });
    }

    // Check if username exists
    const usernameCheck = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    // Check if email exists
    const emailCheck = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);

    if (usernameCheck.rowCount > 0 && emailCheck.rowCount > 0) {
      return res.render('signup', { error: 'Both username and email are already taken.' });
    } else if (usernameCheck.rowCount > 0) {
      return res.render('signup', { error: 'Username is already taken.' });
    } else if (emailCheck.rowCount > 0) {
      return res.render('signup', { error: 'Email is already taken.' });
    }

    // Hash password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Insert new user into DB along with OTP and expiration (e.g., 10 min)
    await pool.query(
      `INSERT INTO users (username, email, password, otp, otp_expires, verified)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes', false)`,
      [username, email, hashedPassword, otp]
    );

    // Setup Nodemailer transporter (use your SMTP credentials)
    let transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",   // your SMTP host
      port: 587,
      secure: false,                  // your SMTP port
      auth: {
        user: "thedossiercreatives@gmail.com",  // your SMTP username
        pass: "riso kltz lhbk jyvv"      // your SMTP password
      }
    });

    // Send OTP email
    await transporter.sendMail({
      from: '"TETRA" <no-reply@tetra.com>',
      to: email,
      subject: "Verify your email - OTP code",
      text: `Your verification code is: ${otp}`,
      html: `<p>Your verification code is: <b>${otp}</b></p>`
    });

    // Redirect to OTP verification page
    res.redirect(`/auth?email=${encodeURIComponent(email)}`);

  } catch (error) {
    console.error('Signup error:', error);
    res.render('signup', { error: 'Internal Server Error. Please try again later.' });
  }
});


router.get('/test-email', async (req, res) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "thedossiercreatives@gmail.com",
      pass: "riso kltz lhbk jyvv"
    }
  });

  try {
    await transporter.sendMail({
      from: '"TETRA" <no-reply@tetra.com>',
      to: "iriscontadotoo@gmail.com",
      subject: "Test Email",
      text: "This is a test email from TETRA"
    });
    res.send("✅ Email sent successfully!");
  } catch (err) {
    console.error("❌ Email error:", err);
    res.status(500).send("Failed to send email");
  }
});



router.post('/verify-otp', async (req, res) => {
  const { email } = req.query;
  const { otp } = req.body;

  if (!otp) {
    return res.render('auth', {
      error: 'Please enter the OTP.',
      email
    });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );

    if (result.rowCount === 0) {
      return res.render('auth', {
        error: 'User not found.',
        email
      });
    }

    const user = result.rows[0];

    // Check if OTP matches and is not expired
    if (user.otp !== otp || new Date(user.otp_expires) < new Date()) {
      return res.render('auth', {
        error: 'Invalid or expired OTP. Please try again.',
        email
      });
    }

    // Generate 20-character acode: YYYYMMDD-XXXXXXXX
    const generateUniqueAcode = async () => {
      const date = new Date();
      const yyyy = date.getFullYear().toString();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const datePart = `${yyyy}${mm}${dd}`;
      
      while (true) {
        const randomPart = crypto.randomBytes(4).toString('hex'); // 8 chars
        const acode = `${datePart}-${randomPart}`;
        const check = await pool.query('SELECT 1 FROM users WHERE acode = $1', [acode]);
        if (check.rowCount === 0) return acode;
      }
    };

    const acode = await generateUniqueAcode();

    // Mark user as verified, set account_mode to 'regular', and save acode
await pool.query(
  `UPDATE users 
   SET verified = true, otp = NULL, otp_expires = NULL, acode = $1, account_mode = 'regular'
   WHERE email = $2`,
  [acode, email]
);


    // Create session
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email
    };

    res.redirect('/pricing');

  } catch (err) {
    console.error('OTP verification error:', err);
    res.render('auth', {
      error: 'Something went wrong. Please try again later.',
      email
    });
  }
});

// GET route for pricing page
router.get('/pricing', (req, res) => {
  res.render('pricing'); // This assumes you have a 'pricing.ejs' file in your views folder
});



router.post('/create-paypal-order', async (req, res) => {
  const plan = req.query.plan;
  const allowedPlans = ['basic', 'mid', 'pro'];

  if (!allowedPlans.includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan type' });
  }

  // Define prices in USD
  const prices = {
    basic: "5.00",
    mid: "10.00",
    pro: "25.00"
  };

  try {
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',       // 💵 Use USD for these values
          value: prices[plan]
        }
      }]
    });

    const response = await client.execute(request);

    res.json({ id: response.result.id });
  } catch (error) {
    console.error('PayPal order creation failed:', error);
    res.status(500).json({ error: 'Failed to create PayPal order' });
  }
});







router.post('/capture-paypal-order', async (req, res) => {
  const orderID = req.query.orderID;
  const plan = req.query.plan;
  const userId = req.session.user?.id;

  if (!orderID || !plan || !userId) {
    return res.status(400).json({ error: 'Missing orderID, plan, or user session' });
  }

  try {
    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    const response = await client.execute(request);
    console.log("PayPal capture response:", response);

    // 1. Update user's plan and sub_date
    await pool.query(
      'UPDATE users SET plan = $1, sub_date = NOW() AT TIME ZONE \'Asia/Manila\' WHERE id = $2',
      [plan, userId]
    );

    // 2. Retrieve the updated acode and plan
    const userResult = await pool.query(
      'SELECT acode, plan FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length > 0) {
      // 3. Store in session
      req.session.user.acode = userResult.rows[0].acode;
      req.session.user.plan = userResult.rows[0].plan;
    }

    res.json({ status: 'success' });
  } catch (err) {
    console.error('PayPal capture failed:', err);
    res.status(500).json({ error: 'Capture failed' });
  }
});








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
       ORDER BY p.date DESC`
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

    res.render('dashboard', {
      user: req.session.user,
      userAcode: userRow.acode,   // current logged-in user's acode
      pfpUrl: presignedPfpUrl,    // current logged-in user's pfp
      posts
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Something went wrong.');
  }
});






router.get('/create-post', async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT pfp_url, acode FROM users WHERE acode = $1',
      [req.session.user.acode]
    );

    const userRow = userResult.rows[0];

    let presignedPfpUrl = null;
    if (userRow?.pfp_url) {
      const filename = userRow.pfp_url.split('/').pop();
      presignedPfpUrl = await generatePresignedUrl(`pfp/${filename}`);
    } else {
      presignedPfpUrl = await generatePresignedUrl('drawables/default_pfp.png');
    }

    res.render('posting', {
      pfpUrl: presignedPfpUrl,
      userAcode: userRow?.acode // ✅ pass the user's acode to EJS
    });
  } catch (err) {
    console.error('Error fetching profile picture for create-post:', err);
    res.status(500).send('Something went wrong.');
  }
});



router.post('/create-post', upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 5 }
]), async (req, res) => {
  try {
    const { caption } = req.body;
    const acode = req.session.user?.acode;
    const post_id = generatePostId(20);
    const date = new Date();

    if (!acode) return res.status(401).json({ success: false, message: "Unauthorized" });

    const imageUrls = await Promise.all((req.files['images'] || []).map(file => uploadToS3(file, 'images/')));
    const videoUrls = await Promise.all((req.files['videos'] || []).map(file => uploadToS3(file, 'videos/')));

    await pool.query(`
      INSERT INTO posts (post_id, acode, image, track, video, caption, date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [post_id, acode, imageUrls, [], videoUrls, caption, date]);

    res.json({ success: true, message: "Post created!" });
  } catch (err) {
    console.error('Post creation error:', err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


router.get('/media/:type/:filename', async (req, res) => {
  const { type, filename } = req.params;

  // 1. Check if user is logged in and has an allowed plan
  const allowedPlans = ['basic', 'mid', 'pro'];
  if (!req.session.user || !allowedPlans.includes(req.session.user.plan)) {
    return res.status(403).send('Unauthorized');
  }

  // 2. Map type to your S3 folder names
  const folder = type === 'image' ? 'images' :
                 type === 'audio' ? 'audio' :
                 type === 'video' ? 'videos' : null;

  if (!folder) {
    return res.status(400).send('Invalid media type');
  }

  try {
    // 3. Generate a short-lived pre-signed URL (e.g., 1 minute)
    const url = await generatePresignedUrl(`${folder}/${filename}`, 60);

    // 4. Redirect the user to the S3 pre-signed URL
    res.redirect(url);
  } catch (err) {
    console.error('Error generating presigned URL:', err);
    res.status(500).send('Error generating media link');
  }
});


router.get('/profile', compCheck, async (req, res) => {
  const loggedInUser = req.session.user;
  const queryAcode = req.query.acode;
  let isOwnProfile = false;

  try {
    const targetAcode = queryAcode || loggedInUser.acode;
    isOwnProfile = (targetAcode === loggedInUser.acode);

    // ✅ Get current user's profile picture
    const { rows: currentUserRows } = await pool.query(
      'SELECT pfp_url FROM users WHERE id = $1',
      [loggedInUser.id]
    );
    const currentUser = currentUserRows[0] || {};

    let headerPfpUrl = await generatePresignedUrl('drawables/banner_default.png');

if (currentUser.pfp_url) {
  const filename = currentUser.pfp_url.split('/').pop();
  headerPfpUrl = await generatePresignedUrl(`pfp/${filename}`);
}


    // ✅ Target artist
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

    // ✅ Banner
    let bannerUrl = await generatePresignedUrl('drawables/banner_default.png');
    if (user.pfp_url) {
      const filename = user.pfp_url.split('/').pop();
      bannerUrl = await generatePresignedUrl(`pfp/${filename}`);
    }

    const encryptedAcode = encrypt(user.acode);

    // ✅ Followers
    const { rows: followerRows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM follows WHERE following_acode = $1',
      [user.acode]
    );
    const followerCount = followerRows[0]?.count || 0;

    // ✅ Follow state
    let isFollowing = false;
    if (!isOwnProfile) {
      const followCheck = await pool.query(
        'SELECT 1 FROM follows WHERE follower_acode = $1 AND following_acode = $2',
        [loggedInUser.acode, user.acode]
      );
      isFollowing = followCheck.rowCount > 0;
    }

    // ✅ Fetch top tracks (with explicit)
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
      WHERE a.acode = $1
      ORDER BY streams DESC
      LIMIT 10
    `, [targetAcode]);

    const songs = [];
    for (const track of trackRows) {
      let coverUrl = '/path/to/default_cover.jpg';
      if (track.artwork_url) {
        const filename = track.artwork_url.split('/').pop();
        coverUrl = await generatePresignedUrl(`artworks/${filename}`);
      }
      songs.push({
  id: track.track_id,           // ✅ Add this line
  title: track.track_title,
  coverUrl,
  streams: track.streams,
  explicit: track.explicit
});

    }

    // ✅ Fetch albums/releases (with explicit)
    const { rows: albumRows } = await pool.query(`
      SELECT release_id, release_title, artwork_url, release_date, explicit
      FROM albums
      WHERE acode = $1
      ORDER BY upload_date DESC
      LIMIT 5
    `, [targetAcode]);

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
        explicit: album.explicit // ✅ pass text as-is
      });
    }

    // ✅ Final object
    const artist = {
      name: user.artist_name?.trim() || loggedInUser.username || 'Unknown Artist',
      bannerUrl,
      followers: followerCount,
      bio: user.bio?.trim() || '',
      account_mode: user.account_mode,
      acode: encryptedAcode,
      songs,
      releases
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







router.post('/follow', compCheck, async (req, res) => {
  const loggedInUser = req.session.user;
  let { targetAcode } = req.body;

  if (!targetAcode || targetAcode === loggedInUser.acode) {
    return res.status(400).json({ success: false, message: 'Invalid target.' });
  }

  try {
    targetAcode = decrypt(targetAcode); // raw

    const followId = crypto.randomBytes(15).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);

    const existing = await pool.query(
      'SELECT 1 FROM follows WHERE follower_acode = $1 AND following_acode = $2',
      [loggedInUser.acode, targetAcode]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({ success: false, message: 'Already following' });
    }

    await pool.query(
      'INSERT INTO follows (follow_id, follower_acode, following_acode) VALUES ($1, $2, $3)',
      [followId, loggedInUser.acode, targetAcode]
    );

    res.json({ success: true, message: 'Followed successfully' });
  } catch (err) {
    console.error('Error following artist:', err);
    res.status(500).json({ success: false, message: 'Failed to follow' });
  }
});


router.post('/unfollow', compCheck, async (req, res) => {
  const loggedInUser = req.session.user;
  let { targetAcode } = req.body;

  if (!targetAcode || targetAcode === loggedInUser.acode) {
    return res.status(400).json({ success: false, message: 'Invalid target.' });
  }

  try {
    targetAcode = decrypt(targetAcode); // raw

    const result = await pool.query(
      'DELETE FROM follows WHERE follower_acode = $1 AND following_acode = $2',
      [loggedInUser.acode, targetAcode]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Not following' });
    }

    res.json({ success: true, message: 'Unfollowed successfully' });
  } catch (err) {
    console.error('Error unfollowing artist:', err);
    res.status(500).json({ success: false, message: 'Failed to unfollow' });
  }
});






// GET /edit-profile
router.get('/edit-profile', compCheck, async (req, res) => {
  const { acode } = req.query;

  if (!acode) {
    return res.status(400).send('Missing acode.');
  }

  try {
    // Decrypt the acode from query
    const decryptedAcode = decrypt(acode);

    // Fetch only the needed fields from users table
    const result = await pool.query(
      'SELECT artist_name, main_genre, bio, pfp_url, acode FROM users WHERE acode = $1',
      [decryptedAcode]
    );

    if (result.rowCount === 0) {
      return res.status(404).send('User not found.');
    }

    const user = result.rows[0];

    // Encrypt acode again for safe form use
    const encryptedAcode = encrypt(user.acode);

    // Generate presigned pfp URL
    let presignedPfpUrl;
    if (user.pfp_url) {
      const filename = user.pfp_url.split('/').pop();
      presignedPfpUrl = await generatePresignedUrl(`pfp/${filename}`);
    } else {
      presignedPfpUrl = await generatePresignedUrl('drawables/banner_default.png');
    }

    // ✅ Always include current logged-in user's acode from session
    const userAcode = req.session.user.acode;

    res.render('edit-profile', {
      user: {
        artistName: user.artist_name,
        genre: user.main_genre,
        bio: user.bio,
        acode: encryptedAcode
      },
      pfpUrl: presignedPfpUrl,
      userAcode // now available to your EJS as <%= userAcode %>
    });

  } catch (err) {
    console.error('Error loading edit profile:', err);
    res.status(500).send('Server error.');
  }
});




// your existing route
router.post('/update-artist', compCheck, upload.single('banner'), async (req, res) => {
  const { artistName, genre, bio, acode } = req.body;

  if (!acode) {
    return res.status(400).json({ message: 'Missing acode.' });
  }

  try {
    const decryptedAcode = decrypt(acode);
    let pfpUrl = null;
    let oldPfpKey = null;

    // Step 1: Fetch current pfp_url
    const userResult = await pool.query('SELECT pfp_url, account_mode FROM users WHERE acode = $1', [decryptedAcode]);
    const user = userResult.rows[0];
    const accountMode = user?.account_mode;
    const oldPfpUrl = user?.pfp_url;

    // Step 2: If a new file is uploaded, upload new one and schedule deletion of old
    if (req.file) {
      pfpUrl = await uploadToS3(req.file, 'pfp/', decryptedAcode);

      // Step 3: Extract key from old S3 URL if exists
      if (oldPfpUrl) {
        const s3UrlPrefix = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
        if (oldPfpUrl.startsWith(s3UrlPrefix)) {
          oldPfpKey = oldPfpUrl.slice(s3UrlPrefix.length);
        }
      }
    }

    // Step 4: Build dynamic update query
    const updateFields = ['artist_name = $1', 'main_genre = $2', 'bio = $3'];
    const values = [artistName, genre, bio];

    if (!accountMode || accountMode === 'regular') {
      updateFields.push('account_mode = $' + (values.length + 1));
      values.push('artist');
    }

    if (pfpUrl) {
      updateFields.push('pfp_url = $' + (values.length + 1));
      values.push(pfpUrl);
    }

    values.push(decryptedAcode);
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE acode = $${values.length}`;
    await pool.query(query, values);

    // Step 5: Delete the old profile picture from S3
    if (oldPfpKey) {
  await deleteFromS3(oldPfpKey);
}


    res.json({ success: true });
  } catch (err) {
    console.error('Error updating artist profile:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});


router.get('/submission', async (req, res) => { 
  try {
    const userResult = await pool.query(
      'SELECT pfp_url, acode FROM users WHERE acode = $1',
      [req.session.user.acode]
    );
    const userRow = userResult.rows[0];

    let presignedPfpUrl;
    if (userRow?.pfp_url) {
      const filename = userRow.pfp_url.split('/').pop();
      presignedPfpUrl = await generatePresignedUrl(`pfp/${filename}`);
    } else {
      presignedPfpUrl = await generatePresignedUrl('drawables/default_pfp.png');
    }

    // get release type from query
    const releaseType = req.query.type;

    // decide template based on type
    let template;
    if (releaseType === 'single') {
      template = 'release-single';
    } else if (releaseType === 'ep') {
      template = 'release-ep';
    } else if (releaseType === 'album') {
      template = 'release-album';
    } else {
      return res.status(400).send('Invalid release type.');
    }

    // generate releaseId
    const releaseId = Array.from(crypto.randomBytes(12))
      .map(byte => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[byte % 62])
      .join('');

    res.render(template, {
      pfpUrl: presignedPfpUrl,
      userAcode: userRow?.acode,
      releaseType,
      releaseId,
      currentUser: userRow?.acode   // ✅ set currentUser to the acode
    });
  } catch (err) {
    console.error('Error fetching profile picture for submission page:', err);
    res.status(500).send('Something went wrong.');
  }
});


// POST /upload-track
router.post('/upload-track', upload.single('track'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No track uploaded' });

    const { releaseId, trackId } = req.body;
    if (!releaseId || !trackId) {
      return res.status(400).json({ success: false, message: 'Missing releaseId or trackId' });
    }

    const s3Key = await uploadTrackToS3(req.file, releaseId, trackId, 'tracks/');

    // Generate presigned URL to preview
    const url = await generatePresignedUrl(s3Key, 3600);

    res.json({ success: true, key: s3Key, url, trackId });
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});


router.post('/delete-track', async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Missing S3 key' });

    await deleteFromS3(key);

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete from S3:', err);
    res.status(500).json({ error: 'Failed to delete track from S3' });
  }
});

// GET /search-artists?q=...
router.get('/search-artists', async (req, res) => {
  try {
    const q = req.query.q;
    const currentUserAcode = req.session.user?.acode;

    if (!q || q.trim() === '') {
      return res.json([]); // empty query
    }

    const searchQuery = `
      SELECT acode, artist_name, pfp_url
      FROM users
      WHERE LOWER(artist_name) LIKE LOWER($1)
      AND acode != $2
      LIMIT 10
    `;

    const { rows } = await pool.query(searchQuery, [`%${q}%`, currentUserAcode]);

    // generate presigned URLs
    const artistsWithPfp = await Promise.all(rows.map(async user => {
      let presignedPfpUrl;
      if (user.pfp_url) {
        const filename = user.pfp_url.split('/').pop(); // get filename
        presignedPfpUrl = await generatePresignedUrl(`pfp/${filename}`);
      } else {
        presignedPfpUrl = await generatePresignedUrl('drawables/default_pfp.png');
      }
      return {
        acode: user.acode,
        artist_name: user.artist_name,
        pfp_url: presignedPfpUrl
      };
    }));

    res.json(artistsWithPfp);
  } catch (err) {
    console.error('Error searching artists:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/check-duplicates', async (req, res) => {
  const { isrcs, upc } = req.body;

  try {
    const duplicateISRCs = [];
    let duplicateUPC = false;

    if (Array.isArray(isrcs) && isrcs.length > 0) {
      // Check existing ISRCs
      const { rows } = await pool.query(
        'SELECT isrc FROM tracks WHERE isrc = ANY($1)',
        [isrcs]
      );
      rows.forEach(row => duplicateISRCs.push(row.isrc));
    }

    if (upc) {
      // Check if UPC already exists
      const { rows } = await pool.query(
        'SELECT 1 FROM albums WHERE upc = $1 LIMIT 1',
        [upc]
      );
      if (rows.length > 0) {
        duplicateUPC = true;
      }
    }

    res.json({ duplicateISRCs, duplicateUPC });
  } catch (err) {
    console.error('Error checking duplicates:', err);
    res.status(500).json({ message: 'Server error checking duplicates' });
  }
});



router.post('/submit-release', upload.any(), async (req, res) => {
  try {
    const {
      release_id, release_title, acode, genre, explicit,
      upc, copyright, phonograph, record_label,
      release_date, release_time, release_zone, track_order, release_type
    } = req.body;

    // Find uploaded files
    const artFile = req.files.find(f => f.fieldname === 'art_url') || null;
    const canvasFile = req.files.find(f => f.fieldname === 'canvas_url') || null;

    let artKey = null, canvasKey = null;
    if (artFile) artKey = await uploadArtworkToS3(artFile, release_id);
    if (canvasFile) canvasKey = await uploadCanvasToS3(canvasFile, release_id);

    // Insert album (set null if field is empty string or undefined)
    await pool.query(`
      INSERT INTO albums
      (release_id, acode, release_title, artwork_url, canvas_url, genre, explicit, upc, tracks,
       copyright, phonograph, record_label, release_date, release_time, release_zone, release_type)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    `, [
      release_id || null,
      acode || null,
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

    // Parse tracks
    let tracks = [];
    if (req.body.tracks) {
      try {
        tracks = JSON.parse(req.body.tracks);
      } catch (e) {
        console.error('Could not parse tracks JSON:', e);
      }
    }
    console.log('Parsed tracks:', tracks);

    // Track order array
    const trackOrderArray = (track_order || '').split(',');

    for (const track of tracks) {
      if (!track.trackId || !track.s3Key) continue; // skip invalid

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
        acode || null,
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



router.get('/api/song-info/:id', async (req, res) => {
  const songId = req.params.id;

  try {
    // Fetch song info including primary artist and features
    const result = await pool.query(`
      SELECT 
        track_title AS title, 
        primary_artist, 
        features, 
        artwork_url AS "coverUrl", 
        audio_url
      FROM tracks
      WHERE track_id = $1
    `, [songId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Song not found' });
    }

    const song = result.rows[0];

    // Get primary artist name
    const primaryArtistResult = await pool.query(
      `SELECT artist_name FROM users WHERE acode = $1 LIMIT 1`,
      [song.primary_artist]
    );
    const primaryArtistName = primaryArtistResult.rows[0]?.artist_name || 'Unknown Artist';

    // Get feature names if available
    let featureNames = [];
    if (song.features) {
      const featureCodes = song.features.split(',').map(code => code.trim());
      if (featureCodes.length > 0) {
        const featureQuery = `SELECT artist_name FROM users WHERE acode = ANY($1)`;
        const featureResult = await pool.query(featureQuery, [featureCodes]);
        featureNames = featureResult.rows.map(r => r.artist_name);
      }
    }

    // Generate presigned URL for audio file in S3
    let audioUrl = null;
    if (song.audio_url) {
      try {
        audioUrl = await generatePresignedUrl(song.audio_url);
      } catch (err) {
        console.warn(`Failed to generate presigned URL for ${song.audio_url}:`, err);
      }
    }

    const artistString = featureNames.length > 0
      ? `${primaryArtistName} feat. ${featureNames.join(', ')}`
      : primaryArtistName;

    res.json({
      title: song.title,
      artist: artistString,
      coverUrl: song.coverUrl,
      audioUrl
    });

  } catch (err) {
    console.error('Error fetching song info:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});












router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Could not log out. Please try again.');
    }
    res.redirect('/login'); // or any other page after logout
  });
});



module.exports = router;