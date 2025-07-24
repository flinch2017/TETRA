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


let environment = new paypal.core.SandboxEnvironment(
  "AZ3vwRr1sqKm0Fm3jQAP8nkMmkCjaYvGxuSYRBaNvfRNOGSdqAJ_xUXKkn8go9a8eS7oegV6lSFkYorj",
  "ECDyl6qPiT5vgCFu0VlDHPZWNTj_4aivacNjo02gNjT63dzvTHeomI6r5IO6v07dExweU1pX6V3gNucb"
);

const client = new paypal.core.PayPalHttpClient(environment);


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

module.exports = router;
