const express = require('express');
const router = express.Router();
const pool = require('../utils/db');

const bcrypt = require('bcrypt');


const moment = require('moment');

const generatePresignedUrl = require('../utils/s3Presign');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const isAjax = req.headers['content-type'] === 'application/json';

  try {
    if (!username || !password) {
      if (isAjax) return res.status(400).json({ error: 'All fields are required.' });
      return res.render('login', { error: 'All fields are required.' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (userResult.rowCount === 0) {
      if (isAjax) return res.status(400).json({ error: 'Username not found.' });
      return res.render('login', { error: 'Username not found.' });
    }

    const user = userResult.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      if (isAjax) return res.status(400).json({ error: 'Incorrect password.' });
      return res.render('login', { error: 'Incorrect password.' });
    }

    if (!user.verified) {
      if (isAjax) {
        return res.status(403).json({ redirect: `/auth?email=${encodeURIComponent(user.email)}` });
      } else {
        return res.redirect(`/auth?email=${encodeURIComponent(user.email)}`);
      }
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      acode: user.acode,
      plan: user.plan,
    };

    if (!user.plan || user.plan === 'none') {
      if (isAjax) {
        return res.json({ redirect: '/pricing' });
      } else {
        return res.redirect('/pricing');
      }
    }

    // Success: redirect to dashboard
    if (isAjax) {
      return res.json({ redirect: '/dashboard' });
    } else {
      return res.redirect('/dashboard');
    }

  } catch (error) {
    console.error('Login error:', error);
    if (isAjax) {
      return res.status(500).json({ error: 'Internal server error. Please try again later.' });
    } else {
      res.render('login', { error: 'Internal server error. Please try again later.' });
    }
  }
});


module.exports = router;
