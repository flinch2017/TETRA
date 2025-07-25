const express = require('express');
const router = express.Router();

// GET /login
router.get('/login', (req, res) => {
  res.render('login', {
    error: '',
    userAcode: null,
    pfpUrl: null,
    showHeader: false,
    showMusicBar: false
  });
});


module.exports = router;
