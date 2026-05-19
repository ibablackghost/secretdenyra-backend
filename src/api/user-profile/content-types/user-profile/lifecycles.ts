declare const strapi: any;

export default {
  async beforeUpdate(event: { params?: { where?: { id?: number }; data?: { accountType?: string } }; state: Record<string, unknown> }) {
    const id = event.params?.where?.id;
    if (!id) return;

    const existing = await strapi.db.query('api::user-profile.user-profile').findOne({
      where: { id },
    });

    event.state.previousAccountType = existing?.accountType;
  },

  async afterUpdate(event: {
    result?: { id?: number; accountType?: string; proApprovedAt?: string | null };
    params?: { data?: { accountType?: string } };
    state?: { previousAccountType?: string };
  }) {
    const nextType = event.params?.data?.accountType;
    if (nextType !== 'professional' || event.state?.previousAccountType === 'professional') {
      return;
    }

    if (event.result?.proApprovedAt) return;

    await strapi.db.query('api::user-profile.user-profile').update({
      where: { id: event.result?.id },
      data: { proApprovedAt: new Date() },
    });
  },
};
