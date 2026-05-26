export default {
  routes: [
    {
      method: 'POST',
      path: '/webhooks/paytech/ipn',
      handler: 'paytech.ipn',
      config: {
        auth: false,
      },
    },
  ],
};
