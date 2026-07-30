'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {addEmployee, updateEmployee, removeEmployee} from '@/lib/actions';
import {TIMESHEET_DEPARTMENTS} from '@/lib/enums';
import {dialogField, dialogLabel} from '@/lib/ui';
import type {TimesheetEmployee} from '@/lib/timesheet';

// Карточка сотрудника табеля: добавление и правка (все сотрудники),
// удаление вместе со сменами — только ADMIN. Скрытие (isActive=false)
// убирает из будущих месяцев, история месяцев с записями остаётся.
export default function EmployeeDialog({
  employee, isAdmin, onClose,
}: {
  employee?: TimesheetEmployee; // есть — правка, нет — новый сотрудник
  isAdmin: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('timesheet');
  const tc = useTranslations('common');
  const router = useRouter();

  const [name, setName] = useState(employee?.name ?? '');
  const [position, setPosition] = useState(employee?.position ?? '');
  const [department, setDepartment] = useState(employee?.department ?? 'AUP');
  const [schedule, setSchedule] = useState(employee?.schedule ?? '');
  const [shiftHours, setShiftHours] = useState(employee?.shiftHours != null ? String(employee.shiftHours) : '');
  const [workPattern, setWorkPattern] = useState(employee?.workPattern ?? '');
  const [isActive, setIsActive] = useState(employee?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!name.trim()) return setError(t('errName'));
    if (!position.trim()) return setError(t('errPosition'));
    const hours = shiftHours.trim() === '' ? null : Math.round(Number(shiftHours));
    if (hours !== null && (!Number.isFinite(hours) || hours < 1 || hours > 24)) {
      return setError(t('errHours'));
    }
    setSaving(true);
    try {
      const input = {
        name, position, department,
        schedule: schedule.trim() || undefined,
        shiftHours: hours,
        workPattern: workPattern.trim() || undefined,
        isActive,
      };
      const res = await (employee ? updateEmployee(employee.id, input) : addEmployee(input));
      if (!res.ok) {
        setError(t('errSave'));
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // Полное удаление (ADMIN): каскадно стираются все смены сотрудника.
  async function remove() {
    if (!employee || !window.confirm(t('deleteConfirm'))) return;
    setSaving(true);
    try {
      await removeEmployee(employee.id);
      router.refresh();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">
            {employee ? t('editEmployee') : t('addEmployee')}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">✕</button>
        </div>

        <label className={dialogLabel}>
          {t('name')}
          <input className={dialogField} value={name} autoFocus
            onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className={dialogLabel}>
            {t('position')}
            <input className={dialogField} value={position}
              onChange={(e) => setPosition(e.target.value)} />
          </label>
          <label className={dialogLabel}>
            {t('department')}
            <select className={dialogField} value={department}
              onChange={(e) => setDepartment(e.target.value)}>
              {TIMESHEET_DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{t(`dept.${d}`)}</option>
              ))}
            </select>
          </label>
        </div>

        <label className={`${dialogLabel} mt-3`}>
          {t('schedule')}
          <input className={dialogField} value={schedule} placeholder={t('scheduleHint')}
            onChange={(e) => setSchedule(e.target.value)} />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className={dialogLabel}>
            {t('shiftHours')}
            <input type="number" min={1} max={24} className={dialogField} value={shiftHours}
              onChange={(e) => setShiftHours(e.target.value)} />
          </label>
          <label className={dialogLabel}>
            {t('workPattern')}
            <input className={dialogField} value={workPattern} placeholder="6/1"
              onChange={(e) => setWorkPattern(e.target.value)} />
          </label>
        </div>

        {employee && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            {t('active')}
          </label>
        )}

        {error && (
          <div role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</div>
        )}

        <div className="mt-4 flex items-center gap-2">
          {employee && isAdmin && (
            <button onClick={remove} disabled={saving}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/40">
              {tc('delete')}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-subtle">
              {t('cancel')}
            </button>
            <button onClick={submit} disabled={saving}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {saving ? '…' : tc('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
