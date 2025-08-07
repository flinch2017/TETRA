// routes/postPayment.js
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
require('dotenv').config();

const CLIENT = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_CLIENT_SECRET;
const BASE_URL = 'https://api-m.paypal.com'; // use https://api-m.sandbox.paypal.com for sandbox

// Get access token
async function getAccessToken() {
  const response = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${CLIENT}:${SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

// Capture subscription details
router.post('/capture-subscription', async (req, res) => {
  const { subscriptionID } = req.body;

  try {
    const accessToken = await getAccessToken();
    const response = await fetch(`${BASE_URL}/v1/billing/subscriptions/${subscriptionID}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    // Save details to DB if needed here
    console.log('Subscription Data:', data);

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Capture Error:', err);
    return res.status(500).json({ success: false });
  }
});

module.exports = router;
