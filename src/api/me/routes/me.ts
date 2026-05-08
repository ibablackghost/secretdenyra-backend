export default {
  routes: [
    {
      method: 'GET',
      path: '/me',
      handler: 'me.profile',
    },
    {
      method: 'PATCH',
      path: '/me',
      handler: 'me.updateProfile',
    },
    {
      method: 'GET',
      path: '/me/addresses',
      handler: 'me.listAddresses',
    },
    {
      method: 'POST',
      path: '/me/addresses',
      handler: 'me.createAddress',
    },
    {
      method: 'PATCH',
      path: '/me/addresses/:addressId',
      handler: 'me.updateAddress',
    },
    {
      method: 'PUT',
      path: '/me/addresses/:addressId',
      handler: 'me.updateAddress',
    },
    {
      method: 'DELETE',
      path: '/me/addresses/:addressId',
      handler: 'me.deleteAddress',
    },
    {
      method: 'POST',
      path: '/me/addresses/:addressId/default',
      handler: 'me.setDefaultAddress',
    },
    {
      method: 'GET',
      path: '/me/orders',
      handler: 'me.orders',
    },
    {
      method: 'GET',
      path: '/me/orders/:orderId',
      handler: 'me.order',
    },
    {
      method: 'GET',
      path: '/me/purchased-products',
      handler: 'me.purchasedProducts',
    },
    {
      method: 'GET',
      path: '/me/wishlist',
      handler: 'me.wishlist',
    },
    {
      method: 'POST',
      path: '/me/wishlist/items',
      handler: 'me.addWishlistItem',
    },
    {
      method: 'DELETE',
      path: '/me/wishlist/items/:productId',
      handler: 'me.deleteWishlistItem',
    },
    {
      method: 'GET',
      path: '/me/viewed-products',
      handler: 'me.viewedProducts',
    },
    {
      method: 'POST',
      path: '/me/viewed-products',
      handler: 'me.addViewedProduct',
    },
  ],
};
