'use client';

import {useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {saveClient} from '@/lib/actions';
import {dialogField, dialogLabel} from '@/lib/ui';
import type {MockClient} from '@/lib/types';

/**
 * Поле «Клиент» диалога брони: комбобокс с поиском по имени/цифрам телефона
 * + инлайн-создание нового клиента (FR-CLI-4). Выбор обязателен явно:
 * редактирование текста сбрасывает выбор до клика по подсказке.
 */
export default function ClientPicker({
  clients, value, initialName, onChange,
}: {
  clients: MockClient[];
  value: string; // выбранный clientId ('' — не выбран)
  initialName?: string;
  onChange: (id: string) => void;
}) {
  const tb = useTranslations('booking');
  const tc = useTranslations('clients');
  const router = useRouter();

  const [query, setQuery] = useState(initialName ?? '');
  const [open, setOpen] = useState(false);

  // Инлайн-создание клиента
  const [newOpen, setNewOpen] = useState(false);
  const [nName, setNName] = useState('');
  const [nPhone, setNPhone] = useState('');
  const [nErr, setNErr] = useState<string | null>(null);

  // Подстрочный поиск: по имени и по цифрам телефона; показываем первые 8.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    const list = !q
      ? clients
      : clients.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (qDigits !== '' && c.phone.replace(/\D/g, '').includes(qDigits)),
        );
    return list.slice(0, 8);
  }, [clients, query]);

  function pick(c: MockClient) {
    onChange(c.id);
    setQuery(c.name);
    setOpen(false);
  }

  async function createClient() {
    setNErr(null);
    const res = await saveClient({name: nName.trim(), phone: nPhone.trim()});
    if (!res.ok) {
      setNErr(tc('duplicatePhone')); // единственная ожидаемая ошибка — занятый телефон
      return;
    }
    onChange(res.client.id);
    setQuery(res.client.name);
    setNewOpen(false);
    setNName('');
    setNPhone('');
    // Подтягиваем нового клиента в список (перечитываем серверные данные).
    router.refresh();
  }

  return (
    <div className={dialogLabel}>
      <span className="flex items-center justify-between">
        {tb('client')}
        <button type="button" className="text-[10px] text-blue-600 hover:underline" onClick={() => setNewOpen((v) => !v)}>
          {tb('newClient')}
        </button>
      </span>
      {newOpen ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-subtle p-2">
          <input className={dialogField} placeholder={tb('newClientName')} value={nName} onChange={(e) => setNName(e.target.value)} />
          <input className={dialogField} placeholder={tb('newClientPhone')} value={nPhone} onChange={(e) => setNPhone(e.target.value)} />
          {nErr && <span role="alert" className="text-[11px] text-red-600">{nErr}</span>}
          <button
            type="button"
            disabled={!nName.trim() || !nPhone.trim()}
            onClick={createClient}
            className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {tb('addClient')}
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            className={`${dialogField} w-full`}
            value={query}
            placeholder={tb('clientSearch')}
            onChange={(e) => {
              setQuery(e.target.value);
              onChange(''); // выбор обязателен явно — сброс до клика по подсказке
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
          />
          {open && matches.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-44 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
              {matches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  // onMouseDown: срабатывает ДО blur инпута, иначе список закроется раньше клика
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(c);
                  }}
                  className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-sm hover:bg-subtle ${
                    c.id === value ? 'bg-subtle' : ''
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted">{c.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
