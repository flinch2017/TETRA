['basic', 'mid', 'pro'].forEach(plan => {
  const containerId = `paypal-button-container-${plan}`;
  if (document.getElementById(containerId)) {
    paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'blue',
        shape: 'pill',
        label: 'pay' // will show “Pay with Debit or Credit Card”
      },
      commit: true,

      createOrder: async function (data, actions) {
        try {
          const res = await fetch(`/create-paypal-order?plan=${plan}`, {
            method: 'POST'
          });
          const order = await res.json();
          if (!order.id) throw new Error("Invalid order response");
          return order.id;
        } catch (error) {
          console.error('Create order failed:', error);
          alert('Failed to create PayPal order. Please try again.');
        }
      },

      onApprove: async function (data, actions) {
        try {
          const res = await fetch(`/capture-paypal-order?orderID=${data.orderID}&plan=${plan}`, {
            method: 'POST'
          });
          const result = await res.json();
          window.location.href = '/dashboard';
        } catch (error) {
          console.error('Capture failed:', error);
          alert('Failed to complete PayPal payment. Please try again.');
        }
      },

      onError: function (err) {
        console.error('PayPal error', err);
        alert('There was a problem processing your card payment. Please try again.');
      }
    }).render(`#${containerId}`);
  }
});