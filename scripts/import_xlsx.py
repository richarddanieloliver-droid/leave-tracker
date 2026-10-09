"""Convert the old 'Annual leave record.xlsx' into a JSON file the app can import.

Usage:  python -I scripts/import_xlsx.py "Annual leave record.xlsx" data/import.json

Uses only the Python standard library. Each year block in the sheet starts with
"<year> | Leave allocation (days):". Imported entries keep the days typed in the
sheet (as a manual override) so remaining totals match the spreadsheet.
"""
import datetime as dt
import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
EXCEL_EPOCH = dt.date(1899, 12, 30)
TODAY = dt.date.today()


# ---------- England & Wales bank holidays (mirrors src/lib/bankHolidays.ts) ----------

def easter(y):
    a = y % 19; b = y // 100; c = y % 100; d = b // 4; e = b % 4
    f = (b + 8) // 25; g = (b - f + 1) // 3; h = (19 * a + b - d - g + 15) % 30
    i = c // 4; k = c % 4; l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = (h + l - 7 * m + 114) % 31 + 1
    return dt.date(y, month, day)


def first_monday(y, m):
    d = dt.date(y, m, 1)
    return d + dt.timedelta(days=(7 - d.weekday()) % 7)


def last_monday(y, m):
    d = dt.date(y + (m == 12), m % 12 + 1, 1) - dt.timedelta(days=1)
    return d - dt.timedelta(days=d.weekday())


def bank_holidays(y):
    days = set()
    ny = dt.date(y, 1, 1)
    days.add(ny + dt.timedelta(days={5: 2, 6: 1}.get(ny.weekday(), 0)))
    e = easter(y)
    days |= {e - dt.timedelta(days=2), e + dt.timedelta(days=1)}
    days.add(first_monday(y, 5))
    days.add(last_monday(y, 5))
    days.add(last_monday(y, 8))
    xmas_wd = dt.date(y, 12, 25).weekday()
    xmas = {4: (25, 28), 5: (27, 28), 6: (26, 27)}.get(xmas_wd, (25, 26))
    days |= {dt.date(y, 12, d) for d in xmas}
    # One-off changes
    if y == 2020:
        days.discard(dt.date(2020, 5, 4)); days.add(dt.date(2020, 5, 8))
    if y == 2022:
        days.discard(dt.date(2022, 5, 30))
        days |= {dt.date(2022, 6, 2), dt.date(2022, 6, 3), dt.date(2022, 9, 19)}
    if y == 2023:
        days.add(dt.date(2023, 5, 8))
    return days


def working_days(start, end, part):
    if not start:
        return None
    end = end or start
    if start == end and part in ('AM', 'PM'):
        return 0.5
    bh = set()
    for y in range(start.year, end.year + 1):
        bh |= bank_holidays(y)
    n, d = 0, start
    while d <= end:
        if d.weekday() < 5 and d not in bh:
            n += 1
        d += dt.timedelta(days=1)
    return n


# ---------- xlsx reading ----------

def read_rows(path):
    z = zipfile.ZipFile(path)
    strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).iter(NS + 'si'):
            strings.append(''.join(t.text or '' for t in si.iter(NS + 't')))
    rows = {}
    for row in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).iter(NS + 'row'):
        cells = {}
        for c in row.iter(NS + 'c'):
            v = c.find(NS + 'v')
            if v is None or v.text is None:
                continue
            val = strings[int(v.text)] if c.get('t') == 's' else v.text
            cells[re.match(r'[A-Z]+', c.get('r')).group()] = val.strip() if isinstance(val, str) else val
        rows[int(row.get('r'))] = cells
    return rows


def to_date(v):
    """Returns (date, was_text)."""
    if v in (None, ''):
        return None, False
    try:
        return EXCEL_EPOCH + dt.timedelta(days=int(float(v))), False
    except ValueError:
        return dt.datetime.strptime(v, '%d/%m/%Y').date(), True


def to_num(v):
    if v in (None, ''):
        return None
    f = float(v)
    return int(f) if f.is_integer() else f


def main(src, out):
    rows = read_rows(src)
    years, entries = {}, []
    current = None
    for r in sorted(rows):
        c = rows[r]
        if c.get('B', '').startswith('Leave allocation'):
            current = int(float(c['A']))
            years[current] = {'year': current, 'base_entitlement': 25, 'carried_in': 0,
                              'adjustment': 0, 'adjustment_note': None,
                              '_total': to_num(c.get('D'))}
            continue
        if current is None or c.get('A') == 'Reason' or not c.get('A'):
            continue

        reason, notes = c['A'], c.get('I') or None
        if reason == 'Carry over to next year':
            years[current]['_carry_out'] = to_num(c.get('E'))
            continue

        start, start_text = to_date(c.get('B'))
        end, end_text = to_date(c.get('C'))
        part = c.get('D') or 'All'
        days = to_num(c.get('E'))
        requested = c.get('G') == 'Y'
        approved = c.get('H') == 'Y'
        cancelled = bool(notes and re.search(r'cancel', notes, re.I)) and not days

        cancelled_on = None
        if cancelled:
            m = re.search(r'(\d{2}/\d{2}/\d{4})', notes)
            if m:
                cancelled_on = dt.datetime.strptime(m.group(1), '%d/%m/%Y').date().isoformat()

        issues = []
        if start_text or end_text:
            issues.append('A date was stored as text in the spreadsheet.')
        if start and start.year != current:
            issues.append(f'Dated {start:%d/%m/%Y} but listed under {current}.')
        if start and end and end < start:
            issues.append('To date is before From date.')
        calc = working_days(start, end, part)
        if not cancelled and days is not None and calc is not None and calc != days:
            issues.append(f'Spreadsheet says {days} day(s) but the dates cover {calc} working day(s).')
        if not cancelled and start and start < TODAY and not approved:
            issues.append('Date has passed but it is not marked approved.')

        entries.append({
            'year': current, 'reason': reason,
            'from_date': start.isoformat() if start else None,
            'to_date': (end or start).isoformat() if start else None,
            'part_of_day': part if part in ('All', 'AM', 'PM') else 'All',
            'days_override': None if cancelled else days,
            'requested': requested, 'approved': approved,
            'cancelled': cancelled, 'cancelled_on': cancelled_on,
            'notes': notes,
            'needs_review': bool(issues), 'review_note': ' '.join(issues) or None,
        })

    # Allocation rows: the sheet stores the total; split it into base + carried + adjustment.
    for y, info in years.items():
        prev = years.get(y - 1)
        carried = prev.get('_carry_out') if prev else None
        if carried is None and prev:
            # 2025 says "includes 1 day carried over" without a carry row in 2024
            carried = {2025: 1}.get(y, 0)
        info['carried_in'] = carried or 0
        if y == 2021:
            info.update(base_entitlement=8, adjustment=1, adjustment_note='1 day borrowed from 2022')
        elif y == 2022:
            info.update(adjustment=-1, adjustment_note='1 day borrowed in 2021')
        total = info['base_entitlement'] + info['carried_in'] + info['adjustment']
        assert total == info['_total'], (y, total, info['_total'])

    out_years = [{k: v for k, v in i.items() if not k.startswith('_')} for i in years.values()]
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({'format': 'leave-tracker/v1', 'years': out_years, 'entries': entries}, f, indent=2)

    print(f'{len(out_years)} years, {len(entries)} entries, '
          f'{sum(e["needs_review"] for e in entries)} flagged for review')
    for e in entries:
        if e['needs_review']:
            print(f'  {e["year"]} {e["reason"]}: {e["review_note"]}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
