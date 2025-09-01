const express = require('express');
const multer = require('multer');
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
const paidCheck = require('../middleware/paidCheck.js');
const paymentRoutes = require('./postPayment');
const fetch = require('node-fetch');
require('dotenv').config();


let environment = new paypal.core.LiveEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_CLIENT_SECRET
);

const client = new paypal.core.PayPalHttpClient(environment);



router.get('/auth', (req, res) => {
  const email = req.query.email; // safely extract email from URL query
  res.render('auth', {
    email,
    error: null,
    userAcode: null,
    pfpUrl: null,
    showHeader: false,     // or true to show
    showMusicBar: false    // or true to show
  });
});





router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, confirmPassword, 'g-recaptcha-response': captcha } = req.body;

    // 1️⃣ Check CAPTCHA presence
    if (!captcha) {
      return res.render('signup', { error: 'Please complete the CAPTCHA.' });
    }

    // 2️⃣ Verify CAPTCHA with Google
    const captchaVerify = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY, // From Google reCAPTCHA
        response: captcha
      })
    });

    const captchaData = await captchaVerify.json();
    if (!captchaData.success) {
      return res.render('signup', { error: 'CAPTCHA verification failed. Please try again.' });
    }

    // 3️⃣ Basic validation
    if (!username || !email || !password || !confirmPassword) {
      return res.render('signup', { error: 'All fields are required.' });
    }

    const usernameRegex = /^[a-z0-9._-]+$/;
    if (!usernameRegex.test(username)) {
      return res.render('signup', {
        error: 'Username can only contain lowercase letters, numbers, and symbols (._-), and no spaces.'
      });
    }

    if (password !== confirmPassword) {
      return res.render('signup', { error: 'Passwords do not match.' });
    }
    if (password.length < 8) {
      return res.render('signup', { error: 'Password must be at least 8 characters.' });
    }

    // 4️⃣ Check if username/email exist
    const usernameCheck = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    const emailCheck = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);

    if (usernameCheck.rowCount > 0 && emailCheck.rowCount > 0) {
      return res.render('signup', { error: 'Both username and email are already taken.' });
    } else if (usernameCheck.rowCount > 0) {
      return res.render('signup', { error: 'Username is already taken.' });
    } else if (emailCheck.rowCount > 0) {
      return res.render('signup', { error: 'Email is already taken.' });
    }

    // 5️⃣ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6️⃣ Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 7️⃣ Insert into DB
    await pool.query(
      `INSERT INTO users (username, email, password, otp, otp_expires, verified)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes', false)`,
      [username, email, hashedPassword, otp]
    );

    // 8️⃣ Send OTP email
    let transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: '"TETRA" <no-reply@tetra.com>',
      to: email,
      subject: "Verify your email - OTP code",
      text: `Your verification code is: ${otp}`,
      html: `<p>Your verification code is: <b>${otp}</b></p>`
    });

    // 9️⃣ Redirect to OTP page
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
    return res.status(400).json({ success: false, error: 'Please enter the OTP.' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const user = result.rows[0];

    // Check if OTP matches and is not expired
    if (user.otp !== otp || new Date(user.otp_expires) < new Date()) {
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP. Please try again.' });
    }

    // Generate unique acode: YYYYMMDD-XXXXXXXX
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

    // Mark user as verified
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

    // Respond with success + redirect target
    res.json({ success: true, redirect: '/pricing' });

  } catch (err) {
    console.error('OTP verification error:', err);
    res.status(500).json({ success: false, error: 'Something went wrong. Please try again later.' });
  }
});


router.post('/resend-otp', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required.' });
  }

  try {
    // Check if user exists
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // Generate new 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Update user record with new OTP + expiration (10 min)
    await pool.query(
      `UPDATE users
       SET otp = $1,
           otp_expires = NOW() + INTERVAL '10 minutes'
       WHERE email = $2`,
      [otp, email]
    );

    // Reuse the same Nodemailer setup from signup
    let transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Send OTP email (same format as signup)
    await transporter.sendMail({
      from: '"TETRA" <no-reply@tetra.com>',
      to: email,
      subject: "Verify your email - OTP code",
      text: `Your verification code is: ${otp}`,
      html: `<p>Your verification code is: <b>${otp}</b></p>`
    });

    res.json({ success: true });

  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});





// GET route for pricing page
router.get('/pricing', paidCheck, (req, res) => {
  res.render('pricing', {
    userAcode: null,
    pfpUrl: null,
    showHeader: false,     // or true to show
    showMusicBar: false    // or true to show
  });
});




router.post('/create-paypal-order', async (req, res) => {
  const plan = req.query.plan;
  const allowedPlans = ['basic', 'mid', 'pro'];

  if (!allowedPlans.includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan type' });
  }

  // Define prices in PHP
  const prices = {
    basic: "5.00", // Example PHP equivalent of $5
    mid: "560.00",   // Example PHP equivalent of $10
    pro: "1400.00"   // Example PHP equivalent of $25
  };

  try {
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'PHP', // 🇵🇭 Philippine Peso
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

module.exports = router;
