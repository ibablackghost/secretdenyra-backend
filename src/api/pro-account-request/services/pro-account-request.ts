import { factories } from '@strapi/strapi';

import {
  approveProAccountForUser,
  ensureUserProfile,
  getNotifyEmail,
  isProfessionalAccount,
  proRequestPayload,
  sanitizeProRequestInput,
  sendProRequestAdminEmail,
  sendProRequestUserEmail,
  validateProRequestInput,
} from '../../../utils/pro-account';

declare const strapi: any;

export default factories.createCoreService('api::pro-account-request.pro-account-request' as any, ({ strapi }) => ({
  async getLatestForUser(userId: number) {
    return strapi.db.query('api::pro-account-request.pro-account-request').findOne({
      where: { user: { id: userId } },
      orderBy: [{ createdAt: 'desc' }],
    });
  },

  async getPendingForUser(userId: number) {
    return strapi.db.query('api::pro-account-request.pro-account-request').findOne({
      where: {
        user: { id: userId },
        status: 'pending',
      },
    });
  },

  async submitForUser(user: { id: number; email: string; username?: string }, body: Record<string, unknown>) {
    const profile = await ensureUserProfile(strapi, user.id);
    if (isProfessionalAccount(profile)) {
      return { error: 'ALREADY_PROFESSIONAL', message: 'Votre compte est déjà un compte professionnel.' };
    }

    const pending = await this.getPendingForUser(user.id);
    if (pending) {
      return { error: 'REQUEST_ALREADY_PENDING', message: 'Une demande est déjà en cours de traitement.' };
    }

    const input = sanitizeProRequestInput(body);
    const validationError = validateProRequestInput(input);
    if (validationError) {
      return { error: 'REQUEST_INVALID', message: validationError };
    }

    const applicantName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || user.username || '';

    const request = await strapi.db.query('api::pro-account-request.pro-account-request').create({
      data: {
        ...input,
        applicantEmail: user.email,
        applicantName,
        status: 'pending',
        user: user.id,
      },
    });

    try {
      await sendProRequestAdminEmail(strapi, request, user);
    } catch (err) {
      strapi.log.error('[pro-account] Échec envoi email admin.', err);
    }

    return { request: proRequestPayload(request) };
  },

  async processStatusChange(requestId: number, nextStatus: string, previousStatus?: string) {
    if (!['approved', 'rejected'].includes(nextStatus) || nextStatus === previousStatus) {
      return;
    }

    const request = await strapi.db.query('api::pro-account-request.pro-account-request').findOne({
      where: { id: requestId },
      populate: { user: true },
    });

    if (!request || request.reviewedAt) return;

    const reviewedAt = new Date();
    await strapi.db.query('api::pro-account-request.pro-account-request').update({
      where: { id: requestId },
      data: { reviewedAt },
    });

    const user = request.user;
    if (!user?.id) return;

    if (nextStatus === 'approved') {
      await approveProAccountForUser(strapi, user.id);
    }

    try {
      await sendProRequestUserEmail(
        strapi,
        request.applicantEmail ?? user.email,
        nextStatus as 'approved' | 'rejected',
        String(request.companyName ?? ''),
      );
    } catch (err) {
      strapi.log.error('[pro-account] Échec envoi email utilisateur.', err);
    }
  },

  isEmailConfigured() {
    return Boolean(getNotifyEmail(strapi));
  },
}));
