const express = require('express');
const router = express.Router();

// GET /signup
router.get('/signup', (req, res) => {
  res.render('signup', { error: '' });
});

module.exports = router;
