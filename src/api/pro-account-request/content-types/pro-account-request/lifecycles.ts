declare const strapi: any;

export default {
  async beforeUpdate(event: {
    params?: { where?: { id?: number }; data?: { status?: string } };
    state: Record<string, unknown>;
  }) {
    const id = event.params?.where?.id;
    if (!id) return;

    const existing = await strapi.db.query('api::pro-account-request.pro-account-request').findOne({
      where: { id },
    });

    event.state.previousStatus = existing?.status;
  },

  async afterUpdate(event: {
    result?: { id?: number };
    params?: { data?: { status?: string } };
    state?: { previousStatus?: string };
  }) {
    const nextStatus = event.params?.data?.status;
    if (!nextStatus || !event.result?.id) return;
    if (event.state?.previousStatus === nextStatus) return;

    await strapi.service('api::pro-account-request.pro-account-request').processStatusChange(
      event.result.id,
      nextStatus,
      event.state?.previousStatus,
    );
  },
};
