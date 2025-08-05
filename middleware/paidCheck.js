const pool = require('../utils/db');

async function paidCheck(req, res, next) {
  try {
    if (!req.session.user || !req.session.user.acode) {
      return res.redirect('/login');
    }

    const result = await pool.query(
      'SELECT plan, verified FROM users WHERE acode = $1',
      [req.session.user.acode]
    );

    if (result.rows.length === 0) {
      return res.redirect('/login');
    }

    const { plan, verified } = result.rows[0];
    const referer = req.get('Referer') || '/';

    if (!verified) {
      return res.redirect(referer);
    }

    if (plan !== null) {
      return res.redirect(referer);
    }

    next();

  } catch (err) {
    console.error('Error in paidCheck middleware:', err);
    res.status(500).send('Internal Server Error');
  }
}

module.exports = paidCheck;
