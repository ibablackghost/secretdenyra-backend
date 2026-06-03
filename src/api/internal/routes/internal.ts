export default {
  routes: [
    {
      method: 'GET',
      path: '/internal/checkouts',
      handler: 'internal.listCheckouts',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/internal/orders',
      handler: 'internal.listOrders',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/internal/payments',
      handler: 'internal.listPayments',
      config: { auth: false },
    },
  ],
};
