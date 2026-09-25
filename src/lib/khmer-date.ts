const KHMER_DIGITS = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];

export function toKhmerNumeral(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => KHMER_DIGITS[Number(d)]);
}

const KHMER_WEEKDAYS = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];

const KHMER_MONTHS = [
  'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
  'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ',
];

export function khmerWeekday(date: Date): string {
  return KHMER_WEEKDAYS[date.getDay()];
}

export function khmerMonth(date: Date): string {
  return KHMER_MONTHS[date.getMonth()];
}

/** e.g. "ថ្ងៃសុក្រ ១០ ខែកក្កដា ឆ្នាំ២០២៦" */
export function formatKhmerGregorianDate(date: Date): string {
  return `ថ្ងៃ${khmerWeekday(date)} ទី${toKhmerNumeral(date.getDate())} ខែ${khmerMonth(date)} ឆ្នាំ${toKhmerNumeral(date.getFullYear())}`;
}

/** e.g. "៨:០០ នាទីព្រឹក" */
export function formatKhmerTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours < 12 ? 'ព្រឹក' : hours < 18 ? 'ល្ងាច' : 'យប់';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${toKhmerNumeral(displayHour)}:${toKhmerNumeral(String(minutes).padStart(2, '0'))} នាទី${period}`;
}

/** English ordinal suffix: 1 → "st", 2 → "nd", 3 → "rd", 11 → "th", 21 → "st" */
export function englishOrdinalSuffix(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return 'th';
  return ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
}

const KHMER_ZODIAC_ANIMALS = ['ជូត', 'ឆ្លូវ', 'ខាល', 'ថោះ', 'រោង', 'ម្សាញ់', 'មមី', 'មមែ', 'វក', 'រកា', 'ច', 'កុរ'];

const KHMER_SAK = [
  'ឯកស័ក', 'ទោស័ក', 'ត្រីស័ក', 'ចត្វាស័ក', 'បញ្ចស័ក',
  'ឆស័ក', 'សប្តស័ក', 'អដ្ឋស័ក', 'នព្វស័ក', 'សំរឹទ្ធិស័ក',
];

/**
 * Khmer lunar year name, e.g. 2026 → "មមី អដ្ឋស័ក". The lunar year turns over
 * at Khmer New Year (mid-April), so earlier dates belong to the previous year.
 */
export function khmerLunarYearName(date: Date): string {
  const beforeNewYear = date.getMonth() < 3 || (date.getMonth() === 3 && date.getDate() < 14);
  const year = date.getFullYear() - (beforeNewYear ? 1 : 0);
  const animal = KHMER_ZODIAC_ANIMALS[(((year - 2020) % 12) + 12) % 12];
  const sak = KHMER_SAK[(((year - 2019) % 10) + 10) % 10];
  return `${animal} ${sak}`;
}
