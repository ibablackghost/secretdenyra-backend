import type { StrapiApp } from '@strapi/strapi/admin';

const ImportIcon = () => <span aria-hidden="true">CSV</span>;

export default {
  config: {
    locales: [],
  },
  register(app: StrapiApp) {
    app.addMenuLink({
      to: 'plugins/import-tisanes',
      icon: ImportIcon,
      intlLabel: {
        id: 'import-tisanes.plugin.name',
        defaultMessage: 'Import Tisanes',
      },
      Component: () => import('./pages/ImportTisanes'),
      permissions: [],
      position: 8,
    });

    app.registerPlugin({
      id: 'import-tisanes',
      name: 'Import Tisanes',
    });
  },
  bootstrap() {},
};
