import type { Core } from '@strapi/strapi';

type DocumentAction = 'findMany' | 'findFirst' | 'count';

const LIST_ACTIONS: DocumentAction[] = ['findMany', 'findFirst', 'count'];

const mergeFilters = (existing: Record<string, unknown> | null | undefined, constraint: Record<string, unknown>) => {
  if (!existing || Object.keys(existing).length === 0) return constraint;
  return { $and: [existing, constraint] };
};

const BACKOFFICE_LIST_FILTERS: Partial<Record<string, Record<string, unknown>>> = {
  'api::payment.payment': { status: { $eq: 'SUCCESS' } },
  'api::checkout.checkout': { status: { $eq: 'paid' } },
  'api::order.order': { status: { $eq: 'paid' } },
};

/**
 * Le checkout métier utilise `strapi.db.query` ; ce middleware ne concerne
 * que le Content Manager (listes / compteurs admin).
 */
export const registerBackofficeCommerceViews = (strapi: Core.Strapi) => {
  strapi.documents.use(async (context, next) => {
    const constraint = BACKOFFICE_LIST_FILTERS[context.uid];
    if (!constraint || !LIST_ACTIONS.includes(context.action as DocumentAction)) {
      return next();
    }

    const params = (context.params ?? {}) as { filters?: Record<string, unknown> };
    params.filters = mergeFilters(params.filters, constraint);
    context.params = params as typeof context.params;

    return next();
  });
};
