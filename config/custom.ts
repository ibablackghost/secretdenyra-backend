export default ({ env }: { env: (key: string, defaultValue?: string) => string }) => ({
  proAccount: {
    notifyEmail: env('PRO_ACCOUNT_REQUEST_NOTIFY_EMAIL', ''),
    adminUrl: env('STRAPI_ADMIN_URL', 'http://localhost:1337/admin'),
  },
});
