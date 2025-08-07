// routes/postPayment.js
const express = require('express');
const pool = require('../utils/db'); // adjust path if needed
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

    const {
      id: paypalSubId,
      plan_id,
      status,
      billing_info,
      subscriber
    } = data;

    const nextBillingTime = billing_info?.next_billing_time;
    const payerEmail = subscriber?.email_address;
    const acode = req.session.user?.acode;

    // Determine plan type (based on known plan IDs)
    let planType = null;
    if (plan_id === 'P-8V563971VF056944ENCJB6QQ') planType = 'basic';
    else if (plan_id === 'P-865905246F849110ENCJB53I') planType = 'mid';
    else if (plan_id === 'P-4BJ93315WB274131JNCJBXUQ') planType = 'pro';

    if (!planType) {
      return res.status(400).json({ success: false, message: 'Unknown plan ID' });
    }

    // Save subscription data
    await pool.query(
      `INSERT INTO subscriptions (acode, subscription_id, plan_name, status, next_billing_time, payer_email)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        acode,
        paypalSubId,
        planType,
        status,
        nextBillingTime ? new Date(nextBillingTime) : null,
        payerEmail
      ]
    );

    // Update user's plan and account_mode
    await pool.query(
      `UPDATE users SET plan = $1, account_mode = 'artist' WHERE acode = $2`,
      [planType, acode]
    );

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Capture Error:', err);
    return res.status(500).json({ success: false });
  }
});


module.exports = router;
