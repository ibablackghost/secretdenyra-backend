export default {
  routes: [
    {
      method: 'GET',
      path: '/wishlist',
      handler: 'wishlist-item.list',
    },
    {
      method: 'POST',
      path: '/wishlist/items',
      handler: 'wishlist-item.addItem',
    },
    {
      method: 'DELETE',
      path: '/wishlist/items/:productId',
      handler: 'wishlist-item.deleteByProduct',
    },
  ],
};
