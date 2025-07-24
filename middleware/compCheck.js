// middleware/compCheck.js
const pool = require('../utils/db'); // Adjust this if your pool connection is elsewhere

async function compCheck(req, res, next) {
  try {
    if (!req.session.user || !req.session.user.acode) {
      return res.redirect('/login');
    }

    const result = await pool.query('SELECT plan FROM users WHERE acode = $1', [req.session.user.acode]);

    if (result.rows.length === 0) {
      return res.redirect('/login');
    }

    const userPlan = result.rows[0].plan;

    if (!userPlan) {
      return res.redirect('/pricing');
    }

    next();

  } catch (err) {
    console.error('Error checking user plan:', err);
    res.status(500).send('Internal Server Error');
  }
}

module.exports = compCheck;
