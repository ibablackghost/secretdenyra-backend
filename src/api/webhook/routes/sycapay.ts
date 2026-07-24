export default {
  routes: [
    {
      method: 'POST',
      path: '/webhooks/sycapay',
      handler: 'sycapay.webhook',
      config: {
        auth: false,
      },
    },
  ],
};
