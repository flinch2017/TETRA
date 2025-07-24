const express = require('express');
const router = express.Router();
const pool = require('../utils/db');

const bcrypt = require('bcrypt');


const moment = require('moment');

const generatePresignedUrl = require('../utils/s3Presign');

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

module.exports = router;
