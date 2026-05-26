export default ({ env }: { env: (key: string, defaultValue?: string) => string }) => ({
  proAccount: {
    notifyEmail: env('PRO_ACCOUNT_REQUEST_NOTIFY_EMAIL', ''),
    adminUrl: env('STRAPI_ADMIN_URL', 'http://localhost:1337/admin'),
  },
  paytech: {
    apiKey: env('PAYTECH_API_KEY', ''),
    apiSecret: env('PAYTECH_API_SECRET', ''),
    baseUrl: env('PAYTECH_BASE_URL', 'https://paytech.sn/api'),
    env: env('PAYTECH_ENV', 'prod'),
    ipnUrl: env('PAYTECH_IPN_URL', ''),
    successUrl: env('PAYTECH_SUCCESS_URL', ''),
    cancelUrl: env('PAYTECH_CANCEL_URL', ''),
  },
});
