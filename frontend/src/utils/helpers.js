export const inputClass =
  'block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';

export const apiError = (err) => {
  const body = err?.response?.data;
  const detail = Array.isArray(body?.data?.errors) && body.data.errors[0]?.message;
  return detail || body?.message || err?.message || 'Request failed';
};

export const money = (value, currency = 'USD') => {
  const amount = Number(value || 0);
  const formatted = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${formatted}`;
};

export const today = () => new Date().toISOString().slice(0, 10);

export const monthName = (month) =>
  [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ][Number(month) - 1] || month;

export const downloadCsv = (filename, rows) => {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const printHtml = (title, bodyHtml) => {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { color: #6b7280; font-size: 12px; }
  .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 12px; text-align: left; }
  th { background: #f3f4f6; }
  .totals { margin-top: 16px; font-size: 14px; font-weight: 700; }
</style></head>
<body>${bodyHtml}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
};

export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
