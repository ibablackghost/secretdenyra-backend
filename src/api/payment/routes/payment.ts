export default {
  routes: [
    {
      method: 'GET',
      path: '/payments/:paymentId/status',
      handler: 'payment.status',
      config: { auth: false },
    },
  ],
};
