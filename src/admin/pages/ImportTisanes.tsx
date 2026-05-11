import { getFetchClient } from '@strapi/strapi/admin';
import { FormEvent, useMemo, useState } from 'react';

type ImportReport = {
  dryRun: boolean;
  totalRows: number;
  productsFound: number;
  variantsFound: number;
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  tagsCreated: number;
  tagsUpdated: number;
  productsDeleted: number;
  variantsDeleted: number;
  imagesImported: number;
  errors: Array<{ scope: string; message: string }>;
};

const cardStyle = {
  background: '#fff',
  border: '1px solid #eaeaef',
  borderRadius: 12,
  padding: 24,
  boxShadow: '0 1px 4px rgba(33, 33, 52, 0.08)',
};

const buttonStyle = {
  border: 0,
  borderRadius: 8,
  background: '#4945ff',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
  padding: '12px 18px',
};

const statStyle = {
  border: '1px solid #eaeaef',
  borderRadius: 10,
  padding: 16,
};

const formatError = (error: any) => {
  const data = error?.response?.data;
  return data?.message ?? data?.error?.message ?? error?.message ?? 'Import impossible.';
};

const ImportTisanes = () => {
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [importImages, setImportImages] = useState(true);
  const [replaceCategory, setReplaceCategory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);

  const stats = useMemo(
    () =>
      report
        ? [
            ['Lignes', report.totalRows],
            ['Produits CSV', report.productsFound],
            ['Variantes CSV', report.variantsFound],
            ['Produits créés', report.productsCreated],
            ['Produits mis à jour', report.productsUpdated],
            ['Variantes créées', report.variantsCreated],
            ['Variantes mises à jour', report.variantsUpdated],
            ['Produits supprimés', report.productsDeleted],
            ['Variantes supprimées', report.variantsDeleted],
            ['Images importées', report.imagesImported],
          ]
        : [],
    [report],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError('Choisis un fichier CSV avant de lancer l’import.');
      return;
    }

    setIsLoading(true);
    setError('');
    setReport(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dryRun', String(dryRun));
      formData.append('importImages', String(importImages));
      formData.append('replaceCategory', String(replaceCategory));

      const { post } = getFetchClient();
      const response = await post('/admin/import/tisanes', formData);
      setReport(response.data.report);
    } catch (requestError: any) {
      setError(formatError(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={{ padding: 32, background: '#f6f6f9', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <header style={{ marginBottom: 24 }}>
          <p style={{ color: '#666687', fontSize: 13, fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>
            Catalogue Nyra
          </p>
          <h1 style={{ color: '#212134', fontSize: 32, margin: '6px 0 8px' }}>Import CSV Produits</h1>
          <p style={{ color: '#666687', fontSize: 16, margin: 0 }}>
            Dépose un fichier CSV WooCommerce enrichi pour créer ou mettre à jour une catégorie de produits, ses variantes,
            tags et images.
          </p>
        </header>

        <section style={cardStyle}>
          <form onSubmit={handleSubmit}>
            <label style={{ color: '#212134', display: 'block', fontWeight: 700, marginBottom: 8 }}>Fichier CSV</label>
            <input
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              style={{ border: '1px solid #dcdce4', borderRadius: 8, padding: 12, width: '100%' }}
              type="file"
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, margin: '20px 0' }}>
              <label style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
                <input checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} type="checkbox" />
                Test à blanc sans écriture
              </label>

              <label style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
                <input checked={importImages} onChange={(event) => setImportImages(event.target.checked)} type="checkbox" />
                Importer les images externes
              </label>

              <label style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
                <input checked={replaceCategory} onChange={(event) => setReplaceCategory(event.target.checked)} type="checkbox" />
                Remplacer la catégorie du CSV
              </label>
            </div>

            {replaceCategory ? (
              <div style={{ background: '#fff4e5', borderRadius: 8, color: '#7c4a03', marginBottom: 20, padding: 14 }}>
                Attention : cette option supprime définitivement les produits et variantes de la catégorie détectée dans le CSV
                avant de recréer uniquement cette catégorie.
              </div>
            ) : null}

            <button disabled={isLoading} style={{ ...buttonStyle, opacity: isLoading ? 0.65 : 1 }} type="submit">
              {isLoading ? 'Import en cours...' : 'Lancer l’import'}
            </button>
          </form>

          {error ? (
            <div style={{ background: '#fff0f0', borderRadius: 8, color: '#b72b1a', marginTop: 20, padding: 14 }}>{error}</div>
          ) : null}
        </section>

        {report ? (
          <section style={{ ...cardStyle, marginTop: 24 }}>
            <h2 style={{ color: '#212134', marginTop: 0 }}>Rapport d’import</h2>
            <p style={{ color: '#666687' }}>
              Mode : <strong>{report.dryRun ? 'test à blanc' : 'import réel'}</strong>
            </p>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              {stats.map(([label, value]) => (
                <div key={label} style={statStyle}>
                  <div style={{ color: '#666687', fontSize: 13 }}>{label}</div>
                  <div style={{ color: '#212134', fontSize: 26, fontWeight: 800 }}>{value}</div>
                </div>
              ))}
            </div>

            {report.errors.length > 0 ? (
              <div style={{ marginTop: 24 }}>
                <h3>Erreurs ou avertissements</h3>
                <ul style={{ color: '#b72b1a', paddingLeft: 20 }}>
                  {report.errors.map((entry, index) => (
                    <li key={`${entry.scope}-${index}`}>
                      <strong>{entry.scope}</strong> : {entry.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p style={{ color: '#2f6846', fontWeight: 700, marginTop: 24 }}>Aucune erreur détectée.</p>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
};

export default ImportTisanes;
