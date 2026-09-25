import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Column, Text, Span, Photo, sone, Font } from 'sone';
import type { SoneNode, SpanNode } from 'sone';
import { toKhmerNumeral, khmerMonth, khmerLunarYearName, englishOrdinalSuffix } from '../lib/khmer-date';

// Pixel-matched to the Word original (Certificates_of_Rules_of_Origin_and_Export_Procedures).
// Positions come from the design spec in mm; sizes in pt. The layout is done
// in PDF points (72/inch): skia writes one canvas unit as one PDF point, so this
// makes the PDF page exactly A4.
const mm = (v: number) => (v * 72) / 25.4;
const pt = (v: number) => v;

// A4 landscape, no margins — whole points (841.89 × 595.28 rounded) so
// pagination never spills a fraction of a page onto an extra blank page.
const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;

const CONTENT_LEFT = mm(36);
const CONTENT_WIDTH = mm(225.5);
const RIGHT_BLOCK_CENTER = mm(206);
const RIGHT_BLOCK_WIDTH = mm(116);

const KHMER_TITLE_COLOR = '#B68801';
const ENGLISH_TITLE_COLOR = '#996600';
const TEXT_COLOR = '#0070C0';

const MUOL = 'Khmer OS Muol Light';
const SIEMREAP = 'Khmer OS Siemreap';
const BOKOR = 'Bokor';
const SANS = 'Google Sans';

const ASSET_DIR = path.join(process.cwd(), 'assets');
const FONT_DIR = path.join(ASSET_DIR, 'fonts');

const DEFAULT_ORGANIZERS_KH =
  'វិទ្យាស្ថានបណ្តុះបណ្តាលពាណិជ្ជកម្ម និងស្រាវជ្រាវ និងនាយកដ្ឋាននាំចេញ-នាំចូល នៃក្រសួងពាណិជ្ជកម្ម';
const DEFAULT_ORGANIZERS_EN =
  'the Trade Training and Research Institute (TTRI) and the Department of Export Import (DEI) of Ministry of Commerce';
const SIGNER_TITLE = 'រដ្ឋមន្ត្រីក្រសួងពាណិជ្ជកម្ម';

const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Prisma `include` that fetches everything a certificate page needs — shared
// by the staff, portal and bulk endpoints so they all render identically.
export const CERTIFICATE_DOCUMENT_INCLUDE = {
  user: { select: { fullName: true, fullNameKh: true } },
  session: {
    select: {
      title: true,
      titleKh: true,
      batchNo: true,
      organizersKh: true,
      organizersEn: true,
      startDate: true,
      endDate: true,
    },
  },
} as const;

export type CertificateRecord = {
  certificateNo: string;
  user: { fullName: string; fullNameKh: string | null };
  session: {
    title: string;
    titleKh: string | null;
    batchNo: number | null;
    organizersKh: string | null;
    organizersEn: string | null;
    startDate: Date;
    endDate: Date;
  };
};

export type CertificateData = {
  certificateNoKh: string;
  nameKh: string;
  nameEn: string;
  courseTitleKh: string;
  courseTitleEn: string;
  batchNo: number | null;
  startDate: Date;
  endDate: Date;
  organizersKh: string;
  organizersEn: string;
  lunarYearName: string;
};

// Dates are stored in UTC; certificates show the calendar day in Cambodia
// regardless of the server's time zone. Returns a local Date with those parts.
const PHNOM_PENH_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Phnom_Penh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
function inPhnomPenh(date: Date): Date {
  const [y, m, d] = PHNOM_PENH_DATE.format(date).split('-').map(Number);
  return new Date(y, m - 1, d);
}

// "TTRI-005-0012" → "០០៥-០០១២"
function certificateNoToKhmer(certificateNo: string): string {
  return toKhmerNumeral(certificateNo.replace(/^[A-Za-z]+-/, ''));
}

// Runs of "…" are set in Muol Light (as in the Word original); the rest in `font`.
function dotted(text: string, font: string, size: number, dotSize: number): SpanNode[] {
  return text
    .split(/(…+)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('…') ? Span(part).font(MUOL).size(dotSize) : Span(part).font(font).size(size),
    );
}

function sup(text: string, size: number) {
  // U+2060 WORD JOINER keeps the suffix on the same line as its number.
  return Span(`\u2060${text}`).size(size * 0.62).offsetY(-size * 0.22);
}

function khmerDateRange(start: Date, end: Date): string {
  const kn = toKhmerNumeral;
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `ចាប់ពីថ្ងៃទី${kn(start.getDate())} ដល់ ${kn(end.getDate())} ខែ${khmerMonth(end)} ឆ្នាំ${kn(end.getFullYear())}`;
  }
  const startYear = start.getFullYear() === end.getFullYear() ? '' : ` ឆ្នាំ${kn(start.getFullYear())}`;
  return `ចាប់ពីថ្ងៃទី${kn(start.getDate())} ខែ${khmerMonth(start)}${startYear} ដល់ ថ្ងៃទី${kn(end.getDate())} ខែ${khmerMonth(end)} ឆ្នាំ${kn(end.getFullYear())}`;
}

function englishDateRange(start: Date, end: Date, size: number): Array<SpanNode | string> {
  const day = (d: Date) => [String(d.getDate()), sup(englishOrdinalSuffix(d.getDate()), size)];
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startTail = sameMonth
    ? ''
    : ` ${ENGLISH_MONTHS[start.getMonth()]}${start.getFullYear() === end.getFullYear() ? '' : ` ${start.getFullYear()}`}`;
  return [
    'held from ',
    ...day(start),
    `${startTail} to `,
    ...day(end),
    ` ${ENGLISH_MONTHS[end.getMonth()]} ${end.getFullYear()}`,
  ];
}

// Absolutely positioned block — every element on the page is placed by its
// top edge, like the text boxes in the Word template.
type Positionable<T> = {
  position(v: 'absolute'): T;
  top(v: number): T;
  left(v: number): T;
  width(v: number): T;
};

function at<T extends Positionable<T>>(node: T, top: number, left: number, width: number): T {
  return node.position('absolute').top(top).left(left).width(width);
}

const FIT_SCALES = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6];

// Shrink-only fitting: returns the largest scale (≤ 1) at which the text fits.
// Long names stay on one line (maxWidth); long paragraphs stay within their
// line budget (maxHeight) so nothing runs into the block below.
async function fitScale(
  build: (scale: number) => SoneNode,
  { maxWidth, maxHeight }: { maxWidth?: number; maxHeight?: number },
): Promise<number> {
  for (const scale of FIT_SCALES) {
    const canvas = await sone(build(scale)).canvas();
    if ((maxWidth === undefined || canvas.width <= maxWidth) && (maxHeight === undefined || canvas.height <= maxHeight)) {
      return scale;
    }
  }
  return FIT_SCALES[FIT_SCALES.length - 1];
}

@Injectable()
export class CertificateDocumentService {
  private fontsLoaded = false;
  private frame?: Buffer;
  private watermark?: Buffer;

  private async ensureAssetsLoaded() {
    if (this.fontsLoaded) return;
    await Font.load(MUOL, path.join(FONT_DIR, 'KhmerOS_muollight.ttf'));
    await Font.load(SIEMREAP, path.join(FONT_DIR, 'KhmerOS_siemreap.ttf'));
    await Font.load(BOKOR, path.join(FONT_DIR, 'Bokor-Regular.ttf'));
    await Font.load(SANS, [path.join(FONT_DIR, 'GoogleSans-Regular.ttf'), path.join(FONT_DIR, 'GoogleSans-Bold.ttf')]);
    this.frame = readFileSync(path.join(ASSET_DIR, 'images', 'cert-frame.jpg'));
    this.watermark = readFileSync(path.join(ASSET_DIR, 'images', 'ttri-watermark.jpg'));
    this.fontsLoaded = true;
  }

  buildCertificateData(certificate: CertificateRecord): CertificateData {
    const { user, session } = certificate;
    return {
      certificateNoKh: certificateNoToKhmer(certificate.certificateNo),
      nameKh: user.fullNameKh?.trim() || user.fullName,
      nameEn: user.fullName.toUpperCase(),
      courseTitleKh: session.titleKh?.trim() || session.title,
      courseTitleEn: session.title,
      batchNo: session.batchNo,
      startDate: inPhnomPenh(session.startDate),
      endDate: inPhnomPenh(session.endDate),
      organizersKh: session.organizersKh?.trim() || DEFAULT_ORGANIZERS_KH,
      organizersEn: session.organizersEn?.trim() || DEFAULT_ORGANIZERS_EN,
      lunarYearName: khmerLunarYearName(inPhnomPenh(session.endDate)),
    };
  }

  private async page(data: CertificateData): Promise<SoneNode> {
    const kn = toKhmerNumeral;
    const batchKh = data.batchNo ? ` វគ្គទី${kn(data.batchNo)}` : '';

    const nameKhLine = (scale: number) =>
      Text(
        Span('បញ្ជាក់ថាឈ្មោះ ').font(BOKOR).size(pt(15) * scale),
        Span(data.nameKh).font(MUOL).size(pt(16) * scale),
      )
        .color(TEXT_COLOR)
        .nowrap();

    const bodyKh = (scale: number) =>
      Text(
        Span('បានបញ្ចប់វគ្គបណ្តុះបណ្តាលដោយជោគជ័យស្តីពី ').font(BOKOR),
        Span(`"${data.courseTitleKh}"`).font(MUOL),
        Span(`${batchKh} ${khmerDateRange(data.startDate, data.endDate)} ដែលសហការរៀបចំដោយ ${data.organizersKh}។`).font(
          BOKOR,
        ),
      )
        .size(pt(14) * scale)
        .lineHeight(26 / 14)
        .indent(mm(10))
        .align('justify')
        .color(TEXT_COLOR);

    const nameEnLine = (scale: number) =>
      Text(Span('This is to certify that '), Span(data.nameEn).weight('bold'))
        .font(SANS)
        .size(pt(14) * scale)
        .color(TEXT_COLOR)
        .nowrap();

    const bodyEn = (scale: number) => {
      const size = pt(14) * scale;
      return Text(
        'has successfully completed the Training Course on ',
        Span(`“${data.courseTitleEn}”`).weight('bold'),
        ...(data.batchNo
          ? [' ', Span(String(data.batchNo)).weight('bold'), sup(englishOrdinalSuffix(data.batchNo), size), ' Batch']
          : []),
        ', ',
        ...englishDateRange(data.startDate, data.endDate, size),
        ` jointly organized by ${data.organizersEn}.`,
      )
        .font(SANS)
        .size(size)
        .lineHeight(18 / 14)
        .lineBreak('knuth-plass')
        .indent(mm(12.7))
        .align('justify')
        .color(TEXT_COLOR);
    };

    // Line budgets: Khmer body ≤ 3 lines (ends before row 6), English body ≤ 3
    // lines (ends before row 8).
    const [nameKhScale, bodyKhScale, nameEnScale, bodyEnScale] = await Promise.all([
      fitScale(nameKhLine, { maxWidth: CONTENT_WIDTH }),
      fitScale((sc) => bodyKh(sc).width(CONTENT_WIDTH), { maxHeight: pt(26) * 3.5 }),
      fitScale(nameEnLine, { maxWidth: CONTENT_WIDTH }),
      fitScale((sc) => bodyEn(sc).width(CONTENT_WIDTH), { maxHeight: pt(18) * 3.5 }),
    ]);

    const rightBlock = <T extends Positionable<T>>(top: number, node: T) =>
      at(node, top, RIGHT_BLOCK_CENTER - RIGHT_BLOCK_WIDTH / 2, RIGHT_BLOCK_WIDTH);

    return Column(
      // Word keeps the frame's aspect ratio and lets it overflow the page
      // (its white margin is cropped) — measured from the reference PDF.
      Photo(this.frame!).size(mm(308.3), mm(224.8)).scaleType('fill').position('absolute').top(mm(-7.3)).left(mm(-6.2)),
      // The watermark PNG is already washed out, so it is drawn at full opacity.
      Photo(this.watermark!)
        .size(mm(121), mm(119))
        .scaleType('contain')
        .position('absolute')
        .top(mm(50))
        .left((PAGE_WIDTH - mm(121)) / 2),

      // 1 — certificate number
      at(
        Text(
          Span('លេខ ').font(SIEMREAP).size(pt(11)),
          Span(data.certificateNoKh).font(SIEMREAP).size(pt(11)),
          Span(' ព.ណ. ').font(SIEMREAP).size(pt(11)),
          Span('…………').font(MUOL).size(pt(15)),
        ).color(TEXT_COLOR),
        mm(48),
        mm(34),
        mm(80),
      ),

      // 2 — Khmer title
      at(
        Text('វិញ្ញាបនបត្របញ្ជាក់ការសិក្សា').font(MUOL).size(pt(18)).color(KHMER_TITLE_COLOR).align('center'),
        mm(55.5),
        CONTENT_LEFT,
        CONTENT_WIDTH,
      ),

      // 3 — English title
      at(
        Text('Certificate of Completion')
          .font(SANS)
          .weight('bold')
          .size(pt(21))
          .color(ENGLISH_TITLE_COLOR)
          .align('center'),
        mm(66.6),
        CONTENT_LEFT,
        CONTENT_WIDTH,
      ),

      // 4 — "certify that" + Khmer name
      at(nameKhLine(nameKhScale).align('center'), mm(76.4), CONTENT_LEFT, CONTENT_WIDTH),

      // 5 — Khmer body
      at(bodyKh(bodyKhScale).width(CONTENT_WIDTH), mm(86.5), CONTENT_LEFT, CONTENT_WIDTH),

      // 6 — "This is to certify that" + English name
      at(nameEnLine(nameEnScale).align('center'), mm(113.8), CONTENT_LEFT, CONTENT_WIDTH),

      // 7 — English body
      at(bodyEn(bodyEnScale).width(CONTENT_WIDTH), mm(119.5), CONTENT_LEFT, CONTENT_WIDTH),

      // 8 — lunar date (filled by hand)
      rightBlock(
        mm(139),
        Text(...dotted(`ថ្ងៃ………………ខែ……… ឆ្នាំ${data.lunarYearName} ព.ស.២៥៧…`, SIEMREAP, pt(13), pt(15)))
          .lineHeight(20 / 13)
          .color(TEXT_COLOR)
          .align('center'),
      ),

      // 9 — Phnom Penh date (filled by hand)
      rightBlock(
        mm(146.5),
        Text(...dotted('រាជធានីភ្នំពេញ ថ្ងៃទី……ខែ…………ឆ្នាំ២០២…', SIEMREAP, pt(13), pt(15)))
          .lineHeight(21 / 13)
          .color(TEXT_COLOR)
          .align('center'),
      ),

      // 10 — signer title; the space below is left for signature + seal
      rightBlock(
        mm(154.5),
        Text(SIGNER_TITLE).font(MUOL).size(pt(13)).lineHeight(21 / 13).color(TEXT_COLOR).align('center'),
      ),
    )
      .width(PAGE_WIDTH)
      .height(PAGE_HEIGHT)
      .position('relative')
      .overflow('hidden');
  }

  /** One page per certificate, in a single PDF. */
  async buildCertificatePdf(data: CertificateData | CertificateData[]): Promise<Buffer> {
    await this.ensureAssetsLoaded();
    const pages = Array.isArray(data) ? data : [data];

    // Each certificate is rendered on its own page-sized canvas and the
    // canvases are joined into one PDF (as sone's own pdf() does), rather than
    // using sone's pageHeight pagination, which drops or duplicates pages for
    // this absolutely-positioned layout.
    const canvases = await Promise.all(
      pages.map(async (p) =>
        sone(await this.page(p), { width: PAGE_WIDTH, height: PAGE_HEIGHT, background: 'white' }).canvas(),
      ),
    );
    const [first, ...rest] = canvases;
    for (const canvas of rest) first.newPage(PAGE_WIDTH, PAGE_HEIGHT).drawCanvas(canvas, 0, 0);
    return first.toBuffer('pdf');
  }

  /** JPEG preview of a single certificate, for the on-screen viewer. */
  async buildCertificateJpeg(data: CertificateData): Promise<Buffer> {
    await this.ensureAssetsLoaded();
    return sone(await this.page(data), { width: PAGE_WIDTH, height: PAGE_HEIGHT, background: 'white' }).jpg(0.88, {
      density: 2,
    });
  }

  /** PNG preview of a single certificate (used for visual checks). */
  async buildCertificatePng(data: CertificateData): Promise<Buffer> {
    await this.ensureAssetsLoaded();
    return sone(await this.page(data), { width: PAGE_WIDTH, height: PAGE_HEIGHT, background: 'white' }).png({ density: 2 });
  }
}
