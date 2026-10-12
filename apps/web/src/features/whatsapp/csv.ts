export function parseContactsCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' && !quoted) {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('CSV quotation is incomplete.');
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = (rows.shift() ?? []).map((s) =>
    s
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/_+/g, '_'),
  );
  const aliases: Record<string, string> = {
    mobile: 'phone',
    phone_number: 'phone',
    mobile_number: 'phone',
    phone_1_value: 'phone',
    whatsapp: 'phone',
    number: 'phone',
    মোবাইল: 'phone',
    contact_name: 'name',
    full_name: 'name',
    নাম: 'name',
  };
  headers.forEach((header, index) => {
    headers[index] = aliases[header] ?? header;
  });
  if (!headers.includes('phone')) throw new Error('CSV needs a Phone column.');
  return rows
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => {
      const value = (key: string) => (r[headers.indexOf(key)] ?? '').trim();
      const optIn = value('opt_in').toUpperCase() === 'YES';
      const source = value('opt_in_source') || value('consent_source');
      if (optIn && !source) throw new Error('Opt_In=YES needs Opt_In_Source or consent_source.');
      return {
        phone: value('phone'),
        name: value('name'),
        opt_in: optIn,
        consent_source: source || null,
        opt_out: value('opt_out').toUpperCase() === 'YES',
        suppressed: value('suppressed').toUpperCase() === 'TRUE',
      };
    });
}
