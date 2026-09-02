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
