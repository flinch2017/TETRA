const fetch = require('node-fetch'); // Only needed if < Node 18

const CLIENT_ID = 'AcIAKpwvSCs9G682ZO2017hXgpnp25fyxmHhd5RUSPLLRcONWH9OOZidDo86DR7Mbs4k2Mo5oAkHa2lu';
const CLIENT_SECRET = 'EB06p_eTqcc_faRqPdZKnnz36mOKrDVcVf9yelHL_5IIJLFwNwg7sI6Uh02PTF4BBvX9ASZbZjQ34WMf';

// Step 1: Get access token from PayPal
async function getAccessToken() {
  const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

// Step 2: Create Product
async function createProduct(accessToken, name, description) {
  const response = await fetch('https://api-m.sandbox.paypal.com/v1/catalogs/products', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      description,
      type: 'SERVICE',
      category: 'SOFTWARE',
    }),
  });

  const data = await response.json();
  console.log(`✅ Created Product "${name}":`, data.id);
  return data.id; // product_id
}

// Step 3: Create Plan
async function createPlan(accessToken, productId, name, description, price) {
  const response = await fetch('https://api-m.sandbox.paypal.com/v1/billing/plans', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_id: productId,
      name,
      description,
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: {
            interval_unit: 'MONTH',
            interval_count: 1,
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              value: price,
              currency_code: 'USD',
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3,
      },
    }),
  });

  const data = await response.json();
  console.log(`✅ Created Plan "${name}":`, data.id);
  return data.id;
}

// Run the script
(async () => {
  try {
    const accessToken = await getAccessToken();

    const plans = [
      { name: 'Basic Plan', desc: 'Basic monthly subscription', price: '2.99' },
      { name: 'Mid Plan', desc: 'Mid-tier monthly subscription', price: '5.99' },
      { name: 'Pro Plan', desc: 'Pro monthly subscription', price: '9.99' },
    ];

    for (const plan of plans) {
      const productId = await createProduct(accessToken, plan.name, plan.desc);
      const planId = await createPlan(accessToken, productId, plan.name, plan.desc, plan.price);
      console.log(`💡 Use this plan_id for ${plan.name}: ${planId}`);
    }

  } catch (err) {
    console.error('❌ Error:', err);
  }
})();
