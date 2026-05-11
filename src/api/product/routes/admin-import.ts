export default {
  routes: [
    {
      method: 'POST',
      path: '/admin/import/tisanes',
      handler: 'import.importTisanes',
      config: {
        auth: false,
      },
    },
  ],
};
