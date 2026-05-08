export default {
  routes: [
    {
      method: 'GET',
      path: '/cart',
      handler: 'cart.find',
    },
    {
      method: 'POST',
      path: '/cart/items',
      handler: 'cart.addItem',
    },
    {
      method: 'PATCH',
      path: '/cart/items/:itemId',
      handler: 'cart.updateItem',
    },
    {
      method: 'DELETE',
      path: '/cart/items/:itemId',
      handler: 'cart.deleteItem',
    },
  ],
};
