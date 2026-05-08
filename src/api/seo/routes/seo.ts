export default {
  routes: [
    {
      method: 'GET',
      path: '/sitemap.xml',
      handler: 'seo.sitemap',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/robots.txt',
      handler: 'seo.robots',
      config: {
        auth: false,
      },
    },
  ],
};
