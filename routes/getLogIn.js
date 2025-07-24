const express = require('express');
const router = express.Router();

// GET /login
router.get('/login', (req, res) => {
  res.render('login', { error: '' });
});

module.exports = router;
