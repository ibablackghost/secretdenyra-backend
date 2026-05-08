export default {
  routes: [
    {
      method: 'GET',
      path: '/catalog/products',
      handler: 'product.catalog',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/products/catalog',
      handler: 'product.catalog',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/catalog/products/:slug',
      handler: 'product.findBySlug',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/products/slug/:slug',
      handler: 'product.findBySlug',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/products/:slug',
      handler: 'product.findBySlug',
      config: {
        auth: false,
      },
    },
  ],
};
