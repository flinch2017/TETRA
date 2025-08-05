// server.js
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const router = express.Router();
const cron = require('node-cron');
const YOUR_DOMAIN = 'http://localhost:8080'; // Or your real deployed domain
const paypal = require('@paypal/checkout-server-sdk');
const postRoutes = require('./routes/postRoutes');
const dotenv = require('dotenv');
const pool = require('./utils/db'); // adjust path if needed
const s3ImageRoute = require('./routes/s3Image');
const expressLayouts = require('express-ejs-layouts');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;


// Middleware
app.use(helmet());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// EJS setup
app.use(expressLayouts);
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

cron.schedule('0 0 * * *', async () => {
  try {
    const result = await pool.query(
      `DELETE FROM post_seen WHERE seen_at < NOW() - INTERVAL '4 months'`
    );
    if (result.rowCount > 0) {
      console.log(`🧹 Deleted ${result.rowCount} old post_seen entries (older than 4 months)`);
    }
  } catch (err) {
    console.error('Error deleting old post_seen entries:', err);
  }
});


app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://js.stripe.com",
        "https://www.paypal.com",
        "https://www.sandbox.paypal.com",
        "https://cdn.jsdelivr.net"      // ✅ add this line
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com"
      ],
      fontSrc: [
        "'self'",
        "https://cdn.jsdelivr.net",   
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://www.transparenttextures.com",
        "https://www.paypalobjects.com",
        "https://tetrametropolis.s3.us-east-1.amazonaws.com",
        "https://tetrametropolis.s3.amazonaws.com",
        "https://s3.amazonaws.com",
        "http://192.168.1.7:3000"
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
      ],
      mediaSrc: [
        "'self'",
        "blob:",
        "https://tetrametropolis.s3.us-east-1.amazonaws.com"
      ]
    }
  }
}));

// Routes
app.use('/', postRoutes, s3ImageRoute);


const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'localhost.pem')),
};

// Catch-all unknown route handler (place before HTTPS server start)
app.use((req, res, next) => {
  const referer = req.get('Referer');

  if (referer) {
    return res.redirect(referer); // 🔁 Back to previous page
  } else if (req.session?.user) {
    return res.redirect('/dashboard'); // 🔐 If logged in, go to dashboard
  } else {
    return res.redirect('/login'); // 🔑 Not logged in? Go to login
  }
});



http.createServer(app).listen(PORT, () => {
  console.log(`HTTP Server running at http://localhost:${PORT}`);
});
