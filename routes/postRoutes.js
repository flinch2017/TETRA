// routes/postRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const uploadToS3 = require('../utils/uploadToS3');
const pool = require('../utils/db');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const router = express.Router();
const moment = require('moment');
const paypal = require('@paypal/checkout-server-sdk');
const generatePresignedUrl = require('../utils/s3Presign');

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

    // Mark user as verified and save acode
    await pool.query(
      `UPDATE users SET verified = true, otp = NULL, otp_expires = NULL, acode = $1 WHERE email = $2`,
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








router.get('/dashboard', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  try {
    const userResult = await pool.query(
      'SELECT plan FROM users WHERE id = $1',
      [req.session.user.id]
    );

    const userPlan = userResult.rows[0]?.plan;
    if (!userPlan || userPlan === 'none') return res.redirect('/pricing');

    const postsResult = await pool.query(
      `SELECT p.*, u.username 
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

      return {
        post_id: post.post_id,
        username: post.username,
        caption: post.caption,
        images: presignedImages,
        tracks: presignedTracks,
        videos: presignedVideos,
        timeAgo: moment(post.date).fromNow()
      };
    }));

    res.render('dashboard', {
      user: req.session.user,
      posts
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Something went wrong.');
  }
});


router.get('/create-post', (req, res) => {
  res.render('posting'); // Make sure create-post.ejs exists in your views directory
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