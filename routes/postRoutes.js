// routes/postRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const uploadToS3 = require('../utils/uploadToS3');
const { encrypt, decrypt } = require('../utils/encryption.js');
const pool = require('../utils/db');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const router = express.Router();
const moment = require('moment');
const paypal = require('@paypal/checkout-server-sdk');
const generatePresignedUrl = require('../utils/s3Presign');
const uploadTrackToS3 = require('../utils/uploadTrackToS3');
const deleteFromS3 = require('../utils/s3Delete');
const uploadArtworkToS3 = require('../utils/uploadArtworkToS3');
const uploadCanvasToS3 = require('../utils/uploadCanvasToS3');


const app = express();

const getSignUp = require('./getSignUp.js');
const getLogIn = require('./getLogIn.js');
const postLogIn = require('./postLogIn.js');
const postSignUp = require('./postSignUp.js');
const postFollowUnfollow = require('./postFollowUnfollow.js');
const postEditProfile = require('./getEditProfile.js');
const postUpdateArtist = require('./postUpdateArtist.js');
const postCreatePost = require('./postCreatePost.js');
const postUploadTrack = require('./postUploadTrack.js');
const postDeleteTrack = require('./postDeleteTrack.js');
const postCheckDuplicates = require('./postCheckDuplicates.js');
const postSubmitRelease = require('./postSubmitRelease.js');

const getDashboard = require('./getDashboard.js');
const getCreatePost = require('./getCreatePost.js');
const getProfile = require('./getProfile.js');
const getEditProfile = require('./getEditProfile.js');
const getMedia = require('./getMedia.js');
const getSubmission = require('./getSubmission.js');
const getSearchArtists = require('./getSearchArtists.js');
const getMusicPlay = require('./getMusicPlay.js');
const getLogOut = require('./getLogOut.js');
const getMusic = require('./getMusic.js');















// Routes
router.get('/', (req, res) => {
  res.render('welcome', {
    appName: 'TETRA',
    userAcode: null,
    pfpUrl: null,
    showHeader: false,     // or true to show
    showMusicBar: false    // or true to show
  });
});




router.use('/', getSignUp, getLogIn, getDashboard, getProfile, getCreatePost, getEditProfile, getMedia, getSubmission, getSearchArtists, getMusicPlay, getLogOut, getMusic);

router.use('/', postLogIn, postSignUp, postFollowUnfollow, postEditProfile, postUpdateArtist, postCreatePost, postUploadTrack, postDeleteTrack, postCheckDuplicates, postSubmitRelease);




module.exports = router;