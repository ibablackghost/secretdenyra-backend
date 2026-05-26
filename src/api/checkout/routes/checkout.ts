export default {
  routes: [
    {
      method: 'POST',
      path: '/checkout/init',
      handler: 'checkout.init',
      config: { auth: false },
    },
    {
      method: 'PATCH',
      path: '/checkout/:checkoutId',
      handler: 'checkout.updateDraft',
    },
    {
      method: 'GET',
      path: '/checkout/:checkoutId',
      handler: 'checkout.findDraft',
    },
    {
      method: 'GET',
      path: '/checkout/:checkoutId/summary',
      handler: 'checkout.findDraft',
    },
    {
      method: 'POST',
      path: '/checkout/:checkoutId/payment-intent',
      handler: 'checkout.createPaymentIntent',
    },
    {
      method: 'POST',
      path: '/checkout/:checkoutId/payment/paytech',
      handler: 'checkout.createPaytechPayment',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/checkout/:checkoutId/confirm',
      handler: 'checkout.confirm',
      config: { auth: false },
    },
  ],
};
