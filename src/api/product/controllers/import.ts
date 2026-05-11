import fs from 'node:fs';

import { importTisanesCsv } from '../../../utils/import-tisanes';

const jwt = require('jsonwebtoken');

declare const strapi: any;

const getUploadedFile = (files: any) => {
  if (!files) return null;
  const file = files.file ?? files.csv ?? Object.values(files)[0];
  return Array.isArray(file) ? file[0] : file;
};

const authenticateAdmin = async (strapi: any, ctx: any) => {
  const authorization = String(ctx.get('authorization') ?? '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;

  try {
    const secret = strapi.config.get('admin.auth.secret');
    const payload = jwt.verify(token, secret);
    const adminId = payload?.id;
    if (!adminId) return null;

    return await strapi.db.query('admin::user').findOne({
      where: {
        id: adminId,
        isActive: true,
      },
    });
  } catch {
    return null;
  }
};

export default {
  async importTisanes(ctx: any) {
    try {
      const admin = await authenticateAdmin(strapi, ctx);
      if (!admin) {
        ctx.status = 401;
        ctx.body = {
          code: 'ADMIN_UNAUTHORIZED',
          message: 'Authentification admin requise. Reconnecte-toi à l’admin Strapi puis réessaie.',
          requestId: ctx.state?.requestId,
        };
        return;
      }

      const file = getUploadedFile(ctx.request.files);
      const filePath = file?.filepath ?? file?.path;
      const fileName = String(file?.originalFilename ?? file?.name ?? '');
      const extension = fileName.split('.').pop()?.toLowerCase();

      if (!file || !filePath || extension !== 'csv') {
        ctx.status = 400;
        ctx.body = {
          code: 'INVALID_CSV_FILE',
          message: 'Un fichier CSV est requis.',
          requestId: ctx.state?.requestId,
        };
        return;
      }

      const maxSizeMb = Number.parseInt(process.env.IMPORT_CSV_MAX_SIZE_MB ?? '5', 10);
      if (file.size && file.size > maxSizeMb * 1024 * 1024) {
        ctx.status = 413;
        ctx.body = {
          code: 'CSV_TOO_LARGE',
          message: `Le fichier CSV ne doit pas dépasser ${maxSizeMb} Mo.`,
          requestId: ctx.state?.requestId,
        };
        return;
      }

      const csvContent = fs.readFileSync(filePath, 'utf8');
      const report = await importTisanesCsv(strapi, csvContent, {
        dryRun: ctx.request.body?.dryRun === 'true',
        importImages: ctx.request.body?.importImages !== 'false',
      });

      ctx.body = {
        imported: true,
        report,
      };
    } catch (error: any) {
      strapi.log.error('[import-tisanes]', {
        requestId: ctx.state?.requestId,
        message: error.message,
        stack: error.stack,
      });

      ctx.status = 500;
      ctx.body = {
        code: 'IMPORT_FAILED',
        message: error.message || 'Import impossible.',
        requestId: ctx.state?.requestId,
      };
    }
  },
};
