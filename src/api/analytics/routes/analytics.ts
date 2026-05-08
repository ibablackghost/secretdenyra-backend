export default {
  routes: [
    {
      method: 'GET',
      path: '/analytics/config',
      handler: 'analytics.config',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/analytics/events',
      handler: 'analytics.events',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/analytics/funnel',
      handler: 'analytics.funnel',
    },
  ],
};
