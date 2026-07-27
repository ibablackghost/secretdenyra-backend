export default ({ env }: { env: (key: string, defaultValue?: string) => string }) => ({
  proAccount: {
    notifyEmail: env('PRO_ACCOUNT_REQUEST_NOTIFY_EMAIL', ''),
    adminUrl: env('STRAPI_ADMIN_URL', 'http://localhost:1337/admin'),
  },
  orders: {
    // Boîte qui reçoit commandes payées + paiements échoués (test prod = Gmail OK)
    notifyEmail: env('ORDERS_NOTIFY_EMAIL', ''),
  },
  sycapay: {
    baseUrl: env('SYCAPAY_BASE_URL', 'https://ops.sycapay.com/coresystem/part/api'),
    loginApi: env('SYCAPAY_LOGIN_API', ''),
    mdpApi: env('SYCAPAY_MDP_API', ''),
    caCertPath: env('SYCAPAY_CA_CERT_PATH', './ca.crt'),
    clientCertPath: env('SYCAPAY_CLIENT_CERT_PATH', './client.crt'),
    clientKeyPath: env('SYCAPAY_CLIENT_KEY_PATH', './client.key'),
    caCertB64: env('SYCAPAY_CA_CERT_B64', ''),
    clientCertB64: env('SYCAPAY_CLIENT_CERT_B64', ''),
    clientKeyB64: env('SYCAPAY_CLIENT_KEY_B64', ''),
    successUrl: env('SYCAPAY_SUCCESS_URL', ''),
    failedUrl: env('SYCAPAY_FAILED_URL', ''),
    webhookAuth: env('SYCAPAY_WEBHOOK_AUTH', 'HMAC'),
    webhookSecret: env('SYCAPAY_WEBHOOK_SECRET', ''),
  },
});
