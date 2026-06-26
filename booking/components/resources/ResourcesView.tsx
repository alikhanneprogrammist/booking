'use client';

import {useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {setResourceActiveAction, removeResource, removeAddon} from '@/lib/actions';
import type {MockResource, MockAddon} from '@/lib/mock-data';
import ResourceDialog from './ResourceDialog';
import AddonDialog from './AddonDialog';

export default function ResourcesView({
  resources, addons,
}: {
  resources: MockResource[];
  addons: MockAddon[];
}) {
  const t = useTranslations('resources');
  const tg = useTranslations('groups');
  const locale = useLocale();
  const router = useRouter();

  const [resDialog, setResDialog] = useState<{open: boolean; resource?: MockResource}>({open: false});
  const [addonDialog, setAddonDialog] = useState<{open: boolean; addon?: MockAddon}>({open: false});

  const name = (r: MockResource) => (locale === 'kk' ? r.nameKk : r.nameRu);
  const aName = (a: MockAddon) => (locale === 'kk' ? a.nameKk : a.nameRu);

  async function tryDelete(r: MockResource) {
    if (!confirm(t('confirmDelete'))) return;
    const res = await removeResource(r.id);
    if (!res.ok) {
      alert(t('cantDelete'));
      return;
    }
    router.refresh();
  }

  async function toggleActive(r: MockResource) {
    await setResourceActiveAction(r.id, !r.isActive);
    router.refresh();
  }

  async function tryDeleteAddon(a: MockAddon) {
    const res = await removeAddon(a.id);
    if (!res.ok) {
      alert(t('cantDeleteAddon'));
      return;
    }
    router.refresh();
  }

  const btn = 'rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-subtle';

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <button onClick={() => setResDialog({open: true})} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
          + {t('add')}
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {resources.map((r) => (
          <div key={r.id} className={`rounded-xl border border-border bg-card p-4 ${r.isActive ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{backgroundColor: r.color}} />
                <div>
                  <div className="text-sm font-medium">{name(r)}</div>
                  <div className="text-xs text-muted">{tg(r.kind)} · {r.capacity} чел.</div>
                </div>
              </div>
              {!r.isActive && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800">{t('inactive')}</span>}
            </div>
            <div className="mt-2 text-xs text-muted">
              {r.hourlyPrice.toLocaleString()}/ч · мин {r.minHours}ч
              {r.fullDayPrice ? ` · 24ч ${r.fullDayPrice.toLocaleString()}` : ''}
              {r.weekendPrice ? ` · вых ${r.weekendPrice.toLocaleString()}` : ''}
            </div>
            <div className="mt-3 flex gap-2">
              <button className={btn} onClick={() => setResDialog({open: true, resource: r})}>{t('edit')}</button>
              <button className={btn} onClick={() => toggleActive(r)}>
                {r.isActive ? t('deactivate') : t('activate')}
              </button>
              <button className={`${btn} text-red-600`} onClick={() => tryDelete(r)}>{t('delete')}</button>
            </div>
          </div>
        ))}
      </div>

      {/* Доп.услуги (FR-RES-4) */}
      <header className="mb-3 mt-8 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight">{t('addonsTitle')}</h2>
        <button onClick={() => setAddonDialog({open: true})} className={btn}>+ {t('addAddon')}</button>
      </header>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <tbody>
            {addons.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-medium">{aName(a)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-muted">{a.price.toLocaleString()} ₸</td>
                <td className="px-4 py-2 text-xs text-muted">{a.unit === 'PER_EVENT' ? t('PER_EVENT') : t('PER_ITEM')}</td>
                <td className="px-4 py-2 text-right">
                  <button className="text-xs text-muted hover:text-foreground" onClick={() => setAddonDialog({open: true, addon: a})}>{t('edit')}</button>
                  <button className="ml-3 text-xs text-red-600" onClick={() => tryDeleteAddon(a)}>{t('delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resDialog.open && (
        <ResourceDialog
          resource={resDialog.resource}
          onClose={() => setResDialog({open: false})}
          onSaved={() => router.refresh()}
        />
      )}
      {addonDialog.open && (
        <AddonDialog
          addon={addonDialog.addon}
          onClose={() => setAddonDialog({open: false})}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
