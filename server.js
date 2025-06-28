// server.js
require('dotenv').config();
const https = require('https');
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

const YOUR_DOMAIN = 'https://localhost:3000'; // Or your real deployed domain
const paypal = require('@paypal/checkout-server-sdk');
const postRoutes = require('./routes/postRoutes');
const dotenv = require('dotenv');
const pool = require('./utils/db'); // adjust path if needed






dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;






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
        "'unsafe-inline'",
        "https://js.stripe.com",
        "https://www.paypal.com",
        "https://www.sandbox.paypal.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com"
      ],
      fontSrc: [
        "'self'",
        "https://cdn.jsdelivr.net",   // ✅ allow Font Awesome fonts from jsDelivr
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https://www.transparenttextures.com",
        "https://www.paypalobjects.com",
        "https://tetrametropolis.s3.us-east-1.amazonaws.com"
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
app.use('/', postRoutes);


const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'localhost.pem')),
};

https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`HTTPS Server running at https://localhost:${PORT}`);
});
