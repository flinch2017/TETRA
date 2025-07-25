const express = require('express');
const router = express.Router();

// GET /signup
// GET /signup
router.get('/signup', (req, res) => {
  res.render('signup', {
    error: '',
    userAcode: null,
    pfpUrl: null,
    showHeader: false,
    showMusicBar: false
  });
});


module.exports = router;
