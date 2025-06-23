// server.js
const https = require('https');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const router = express.Router();
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const stripe = require('stripe')('sk_test_51Rc3suRcmymA4MNbBS85bMjLg7nFgBGeviOfnHDrd3Y2kZS9oxM39xwJpAANectLnlzZ9H0NVg8JBad8BPfMFxby00yZKq4myf'); // Replace with your real secret key

const YOUR_DOMAIN = 'https://localhost:3000'; // Or your real deployed domain

const paypal = require('@paypal/checkout-server-sdk');

let environment = new paypal.core.LiveEnvironment(
  "AYYBUX4vbKrzzXijC0CpoWHt8HEyX5y76qwy9K39X2CY-O1p3msMxe3y8W4V9V4KdXlUg0jxVyum2oXi",
  "EMJat2KB46kTVzM6DRQeRXgPbvEevl179Gz5KWn_nDVA8oHLB-qQ7HGpa2JGUOqsKc6fDPcFOGaAELhF"
);
let client = new paypal.core.PayPalHttpClient(environment);








dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: false // explicitly disable SSL
});



// Middleware
app.use(helmet());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));


// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Sessions
app.use(
  session({
    store: new pgSession({
      pool: pool,
      tableName: 'session',
    }),
    secret: process.env.SESSION_SECRET || 'tetra_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
  })
);

// Helper to check if username or email already exists
async function userExists(username, email) {
  const result = await pool.query(
    'SELECT id FROM users WHERE username = $1 OR email = $2',
    [username, email]
  );
  return result.rows.length > 0;
}

cron.schedule('*/3 * * * *', async () => {
  try {
    const result = await pool.query(
      `DELETE FROM users WHERE verified = false AND otp_expires <= NOW()`
    );
    console.log(`Deleted ${result.rowCount} unverified expired users`);
  } catch (err) {
    console.error('Error deleting expired unverified users:', err);
  }
});


app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Only if you use inline scripts
        "https://js.stripe.com",
        "https://www.paypal.com",
        "https://www.sandbox.paypal.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Needed for Tailwind + style attributes
        "https://cdn.jsdelivr.net"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https://www.transparenttextures.com",
        "https://www.paypalobjects.com"
      ],
      frameSrc: [
        "'self'",
        "https://js.stripe.com",
        "https://www.paypal.com",
        "https://www.sandbox.paypal.com"
      ],
      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://www.paypal.com",
        "https://www.sandbox.paypal.com"
      ]
    }
  }
}));


// Routes
app.get('/', (req, res) => {
  res.render('welcome', { appName: 'TETRA' });
});

app.get('/signup', (req, res) => {
  res.render('signup', { error: '' });
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
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




app.get('/auth', (req, res) => {
  const email = req.query.email; // safely extract email from URL query
  res.render('auth', { email, error: null });
});


app.post('/signup', async (req, res) => {
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



app.post('/verify-otp', async (req, res) => {
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

    // Check if OTP matches and has not expired
    if (user.otp !== otp || new Date(user.otp_expires) < new Date()) {
      return res.render('auth', {
        error: 'Invalid or expired OTP. Please try again.',
        email
      });
    }

    // Mark user as verified
    await pool.query(
      `UPDATE users SET verified = true, otp = NULL, otp_expires = NULL WHERE email = $1`,
      [email]
    );

    // Create session
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
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
app.get('/pricing', (req, res) => {
  res.render('pricing'); // This assumes you have a 'pricing.ejs' file in your views folder
});

app.post('/create-checkout-session', async (req, res) => {
  const plan = req.query.plan;

  const priceMap = {
    basic: 'price_1Rc4CvRcmymA4MNb353I1peP',
    mid: 'price_1Rc42LRcmymA4MNbvTbLGQ5R',
    pro: 'price_1Rc4DMRcmymA4MNbytNN6qe3'
  };

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price: priceMap[plan],
      quantity: 1
    }],
    mode: 'payment',
    success_url: `${YOUR_DOMAIN}/payment-success?plan=${plan}`,
    cancel_url: `${YOUR_DOMAIN}/pricing`
  });

  res.json({ id: session.id });
});

app.get('/payment-success', async (req, res) => {
  const plan = req.query.plan;
  const userId = req.session.user.id;

  await pool.query('UPDATE users SET plan = $1 WHERE id = $2', [plan, userId]);

  res.redirect('/dashboard');
});

app.post('/create-paypal-order', async (req, res) => {
  const plan = req.query.plan;
  const allowedPlans = ['basic', 'mid', 'pro'];

  if (!allowedPlans.includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan type' });
  }

  try {
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'PHP',       // ✅ Set currency to PHP
          value: "1.00"               // ✅ Flat rate ₱1.00 for all plans
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






app.post('/capture-paypal-order', async (req, res) => {
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

    // Save the user's plan in DB
    await pool.query('UPDATE users SET plan = $1 WHERE id = $2', [plan, userId]);

    res.json({ status: 'success' });
  } catch (err) {
    console.error('PayPal capture failed:', err);
    res.status(500).json({ error: 'Capture failed' });
  }
});






app.get('/dashboard', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login'); // Redirect if not logged in
  }

  try {
    const result = await pool.query(
      'SELECT plan FROM users WHERE id = $1',
      [req.session.user.id]
    );

    if (result.rowCount === 0) {
      return res.redirect('/login'); // In case user no longer exists
    }

    const userPlan = result.rows[0].plan;

    if (!userPlan || userPlan === 'none') {
      return res.redirect('/pricing');
    }

    res.render('dashboard', { user: req.session.user });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Something went wrong.');
  }
});



app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Could not log out. Please try again.');
    }
    res.redirect('/login'); // or any other page after logout
  });
});



const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'localhost.pem')),
};

https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`HTTPS Server running at https://localhost:${PORT}`);
});
