import type { Core } from '@strapi/strapi';

export type AccountType = 'classic' | 'professional';
export type ProRequestStatus = 'pending' | 'approved' | 'rejected';

export const ACCOUNT_TYPES: AccountType[] = ['classic', 'professional'];
export const PRO_REQUEST_STATUSES: ProRequestStatus[] = ['pending', 'approved', 'rejected'];

const filled = (value: unknown) => String(value ?? '').trim().length > 0;

export const isProfessionalAccount = (profile?: { accountType?: string } | null) =>
  profile?.accountType === 'professional';

export const getNotifyEmail = (strapi: Core.Strapi) =>
  String(strapi.config.get('custom.proAccount.notifyEmail') ?? process.env.PRO_ACCOUNT_REQUEST_NOTIFY_EMAIL ?? '').trim();

export const ensureUserProfile = async (strapi: Core.Strapi, userId: number) => {
  const existing = await strapi.db.query('api::user-profile.user-profile').findOne({
    where: { user: { id: userId } },
  });

  if (existing) return existing;

  return strapi.db.query('api::user-profile.user-profile').create({
    data: {
      user: userId,
      accountType: 'classic',
    },
  });
};

export const sanitizeProRequestInput = (body: Record<string, unknown>) => ({
  companyName: String(body?.companyName ?? '').trim(),
  siret: String(body?.siret ?? '').trim(),
  companyPhone: String(body?.companyPhone ?? '').trim(),
  message: String(body?.message ?? '').trim(),
});

export const validateProRequestInput = (input: ReturnType<typeof sanitizeProRequestInput>) => {
  if (!filled(input.companyName)) return 'Le nom de l’entreprise est obligatoire.';
  if (input.siret && input.siret.length < 9) return 'Le numéro SIRET doit contenir au moins 9 caractères.';
  return null;
};

const formatRequestBlock = (request: Record<string, unknown>, user?: { email?: string; username?: string }) => {
  const lines = [
    `Entreprise : ${request.companyName}`,
    request.siret ? `SIRET : ${request.siret}` : null,
    request.companyPhone ? `Téléphone pro : ${request.companyPhone}` : null,
    request.applicantName ? `Contact : ${request.applicantName}` : null,
    request.applicantEmail ? `Email : ${request.applicantEmail}` : user?.email ? `Email : ${user.email}` : null,
    request.message ? `Message :\n${request.message}` : null,
    `Statut : ${request.status}`,
  ].filter(Boolean);

  return lines.join('\n');
};

export const sendProRequestAdminEmail = async (
  strapi: Core.Strapi,
  request: Record<string, unknown>,
  user?: { email?: string; username?: string },
) => {
  const to = getNotifyEmail(strapi);
  if (!to) {
    strapi.log.warn('[pro-account] PRO_ACCOUNT_REQUEST_NOTIFY_EMAIL non configuré — email admin ignoré.');
    return false;
  }

  const adminUrl = String(strapi.config.get('custom.proAccount.adminUrl') ?? process.env.STRAPI_ADMIN_URL ?? '').trim();
  const companyName = String(request.companyName ?? 'Demande compte pro');
  const body = formatRequestBlock(request, user);
  const adminLink = adminUrl
    ? `${adminUrl.replace(/\/$/, '')}/content-manager/collection-types/api::pro-account-request.pro-account-request`
    : '';

  await strapi.plugin('email').service('email').send({
    to,
    subject: `[Nyra] Nouvelle demande compte pro — ${companyName}`,
    text: `${body}\n\n${adminLink ? `Ouvrir l’admin : ${adminLink}` : ''}`,
    html: `
      <p>Une nouvelle demande de compte professionnel a été reçue.</p>
      <pre style="font-family: sans-serif; white-space: pre-wrap;">${body.replace(/</g, '&lt;')}</pre>
      ${adminLink ? `<p><a href="${adminLink}">Voir les demandes dans Strapi</a></p>` : ''}
    `,
  });

  return true;
};

export const sendProRequestUserEmail = async (
  strapi: Core.Strapi,
  to: string,
  status: 'approved' | 'rejected',
  companyName: string,
) => {
  if (!filled(to)) return false;

  const approved = status === 'approved';
  const subject = approved
    ? '[Nyra] Votre compte professionnel est activé'
    : '[Nyra] Votre demande de compte professionnel';
  const text = approved
    ? `Bonjour,\n\nVotre demande de compte professionnel pour « ${companyName} » a été acceptée. Vous pouvez maintenant consulter les tarifs herboristerie sur Nyra.\n\nL’équipe Nyra`
    : `Bonjour,\n\nVotre demande de compte professionnel pour « ${companyName} » n’a pas pu être acceptée pour le moment. Vous pouvez nous contacter pour plus d’informations.\n\nL’équipe Nyra`;

  await strapi.plugin('email').service('email').send({
    to,
    subject,
    text,
    html: `<p>${text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
  });

  return true;
};

export const approveProAccountForUser = async (strapi: Core.Strapi, userId: number) => {
  const profile = await ensureUserProfile(strapi, userId);

  return strapi.db.query('api::user-profile.user-profile').update({
    where: { id: profile.id },
    data: {
      accountType: 'professional',
      proApprovedAt: new Date(),
    },
  });
};

export const proRequestPayload = (request: Record<string, unknown>) => ({
  id: String(request.documentId ?? request.id),
  companyName: request.companyName,
  siret: request.siret ?? '',
  companyPhone: request.companyPhone ?? '',
  message: request.message ?? '',
  status: request.status,
  reviewedAt: request.reviewedAt ?? null,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
});
