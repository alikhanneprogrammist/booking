'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {importClients, type ImportClientResult} from '@/lib/actions';
import {parseClientRows, type ImportClientRow} from '@/lib/import-clients';

/**
 * Импорт гостей из Excel/CSV. Файл разбирается в браузере (SheetJS,
 * динамический импорт), на сервер уходят структурированные строки.
 * Колонки: Имя*, Телефон*, Заметка, Теги, Дата рождения.
 */
export default function ImportClientsDialog({
  onClose, onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const ti = useTranslations('clients.import');

  const [rows, setRows] = useState<ImportClientRow[] | null>(null);
  const [parseErr, setParseErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ImportClientResult[] | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseErr(false);
    setRows(null);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer());
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {header: 1});
      setRows(parseClientRows(matrix));
    } catch {
      setParseErr(true);
    }
  }

  const valid = (rows ?? []).filter((r) => !r.error);

  async function runImport() {
    setBusy(true);
    try {
      const res = await importClients(valid.map(({name, phone, note, tags, dateOfBirth}) => ({
        name, phone, note, tags, dateOfBirth,
      })));
      if (res.ok) {
        setResults(res.results);
        onDone(); // обновляем список гостей за диалогом
      }
    } finally {
      setBusy(false);
    }
  }

  const okCount = results?.filter((r) => r.ok).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">{ti('title')}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">✕</button>
        </div>

        {results ? (
          <>
            <p aria-live="polite" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40">
              {ti('done', {ok: okCount, fail: results.length - okCount})}
            </p>
            {results.some((r) => !r.ok) && (
              <div className="mt-2 overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <tbody>
                    {results.filter((r) => !r.ok).map((r, i) => (
                      <tr key={i} className="border-t border-border first:border-t-0">
                        <td className="px-3 py-1.5">{r.name}</td>
                        <td className="px-3 py-1.5 text-muted">{r.phone}</td>
                        <td className="px-3 py-1.5 text-right text-xs text-red-600">
                          {r.error === 'DUPLICATE_PHONE' ? ti('resDuplicate') : ti('resInvalid')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button onClick={onClose} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
                {ti('close')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted">{ti('hint')}</p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onFile}
              className="mt-3 block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-subtle file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            {parseErr && (
              <div role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">
                {ti('parseError')}
              </div>
            )}
            {rows && rows.length === 0 && <div className="mt-3 text-sm text-muted">{ti('empty')}</div>}

            {rows && rows.length > 0 && (
              <>
                <div className="mt-3 mb-1 text-xs font-medium text-muted">
                  {ti('preview', {ok: valid.length, total: rows.length})}
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.line} className={`border-t border-border first:border-t-0 ${r.error ? 'opacity-60' : ''}`}>
                          <td className="w-8 px-2 py-1.5 text-right text-xs text-muted">{r.line}</td>
                          <td className="px-2 py-1.5">{r.name || '—'}</td>
                          <td className="px-2 py-1.5 text-muted">{r.phone || '—'}</td>
                          <td className="px-2 py-1.5 text-xs text-muted">
                            {r.dateOfBirth ? r.dateOfBirth.toISOString().slice(0, 10) : ''}
                          </td>
                          <td className="px-2 py-1.5 text-right text-xs">
                            {r.error
                              ? <span className="text-red-600">{ti(`err.${r.error}`)}</span>
                              : <span className="text-emerald-600">✓</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-subtle">
                    {ti('close')}
                  </button>
                  <button
                    onClick={runImport}
                    disabled={busy || valid.length === 0}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? ti('importing') : ti('run', {n: valid.length})}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
