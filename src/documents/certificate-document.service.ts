import { Injectable } from '@nestjs/common';
import path from 'node:path';
import { Column, Row, Text, Span, Path, Photo, sone, qrcode, Font } from 'sone';

const PAGE_WIDTH = 1123; // A4 landscape @ 96dpi
const PAGE_HEIGHT = 794;

const NAVY = '#1c3452';
const GOLD = '#b8922f';
const CREAM = '#faf7ef';
const GRAY = '#6b7280';

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts');

const SIGNER_1_NAME = 'Dara Vuthy';
const SIGNER_1_TITLE = 'PROGRAM DIRECTOR';
const SIGNER_2_NAME = 'Lina Sopheak';
const SIGNER_2_TITLE = 'TRAINING MANAGER';
const HOURS_PER_DAY = 8;

export type CertificateData = {
  recipientName: string;
  courseTitle: string;
  hoursText: string;
  dateText: string;
  locationText: string;
  certificateNo: string;
  verifyUrl: string;
  verifyUrlFull: string;
  signer1Name: string;
  signer1Title: string;
  signer2Name: string;
  signer2Title: string;
};

type CertificateRecord = {
  certificateNo: string;
  issuedAt: Date;
  user: { fullName: string };
  session: {
    title: string;
    venue: string;
    program: { durationDays: number };
  };
};

function sunIcon(size = 56) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.28;
  const tickLen = size * 0.14;
  let ticks = '';
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const x1 = cx + Math.cos(angle) * (r + 4);
    const y1 = cy + Math.sin(angle) * (r + 4);
    const x2 = cx + Math.cos(angle) * (r + 4 + tickLen);
    const y2 = cy + Math.sin(angle) * (r + 4 + tickLen);
    ticks += `M${x1},${y1} L${x2},${y2} `;
  }
  const circle = `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`;
  return Path(circle + ' ' + ticks).stroke(NAVY).strokeWidth(1.5).size(size, size);
}

function verifyQrBadge(verifyUrlFull: string, size = 100) {
  const qrBuf = qrcode(verifyUrlFull, { pixelSize: 6 });
  return Column(
    Photo(qrBuf).size(size * 0.7, size * 0.7),
    Text('SCAN TO VERIFY').font('serif').size(7).weight('bold').color(NAVY).align('center').letterSpacing(0.5).margin(4, 0, 0, 0),
  ).alignItems('center').width(size);
}

function cornerBracket(size = 28) {
  return Path(`M0,${size} L0,0 L${size},0`).stroke(NAVY).strokeWidth(2).size(size, size);
}

@Injectable()
export class CertificateDocumentService {
  private fontsLoaded = false;

  private async ensureFontsLoaded() {
    if (this.fontsLoaded) return;
    await Font.load('GreatVibes', path.join(FONT_DIR, 'GreatVibes-Regular.ttf'));
    this.fontsLoaded = true;
  }

  buildCertificateData(certificate: CertificateRecord, origin: string): CertificateData {
    const verifyUrlFull = `${origin}/verify/${certificate.certificateNo}`;
    return {
      recipientName: certificate.user.fullName,
      courseTitle: certificate.session.title,
      hoursText: `${certificate.session.program.durationDays * HOURS_PER_DAY} training hours`,
      dateText: certificate.issuedAt.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      locationText: certificate.session.venue,
      certificateNo: certificate.certificateNo,
      verifyUrl: verifyUrlFull.replace(/^https?:\/\//, ''),
      verifyUrlFull,
      signer1Name: SIGNER_1_NAME,
      signer1Title: SIGNER_1_TITLE,
      signer2Name: SIGNER_2_NAME,
      signer2Title: SIGNER_2_TITLE,
    };
  }

  async buildCertificatePdf(data: CertificateData): Promise<Buffer> {
    await this.ensureFontsLoaded();

    const CONTENT_WIDTH = PAGE_WIDTH - 96;

    const doc = Column(
      Column(
        Row(cornerBracket(), Column().flex(1), cornerBracket().scale(-1, 1)).justifyContent('space-between'),
        Column(
          Row(
            Column().flex(1).height(1).bg(NAVY).margin(0, 12, 0, 0),
            sunIcon(),
            Column().flex(1).height(1).bg(NAVY).margin(0, 0, 0, 12),
          ).alignItems('center').width(360).margin(0, 0, 16, 0),

          Text('CERTIFICATE').font('serif').size(52).weight('bold').color(NAVY).align('center').letterSpacing(4),
          Text('O F   C O M P L E T I O N').font('serif').size(14).color(GOLD).align('center').letterSpacing(2).margin(4, 0, 0, 0),

          Text('This certificate is proudly presented to').font('serif').style('italic').size(14).color(GRAY).align('center').margin(28, 0, 0, 0),

          Column(
            Text(data.recipientName).font('GreatVibes').size(46).color(NAVY).align('center'),
            Column().height(1).width(420).bg(GOLD).margin(4, 0, 0, 0),
          ).alignItems('center').margin(6, 0, 0, 0),

          Text('for successfully completing the training course').font('serif').size(13).color(GRAY).align('center').margin(20, 0, 0, 0),
          Text(data.courseTitle).font('serif').size(20).weight('bold').color(NAVY).align('center').margin(6, 0, 0, 0),

          Text(
            Span(data.hoursText).color(GRAY),
            Span('  ·  ').color(GOLD),
            Span(`Completed on ${data.dateText}`).color(GRAY),
            Span('  ·  ').color(GOLD),
            Span(data.locationText).color(GRAY),
          ).font('serif').size(12).align('center').margin(8, 0, 0, 0),

          Row(
            Column(
              Column().height(1).width(180).bg(NAVY),
              Text(data.signer1Name).font('serif').size(13).weight('bold').color(NAVY).align('center').margin(6, 0, 0, 0),
              Text(data.signer1Title).font('serif').size(9).color(GRAY).align('center').letterSpacing(1).margin(2, 0, 0, 0),
            ).alignItems('center'),

            verifyQrBadge(data.verifyUrlFull),

            Column(
              Column().height(1).width(180).bg(NAVY),
              Text(data.signer2Name).font('serif').size(13).weight('bold').color(NAVY).align('center').margin(6, 0, 0, 0),
              Text(data.signer2Title).font('serif').size(9).color(GRAY).align('center').letterSpacing(1).margin(2, 0, 0, 0),
            ).alignItems('center'),
          ).justifyContent('space-between').alignItems('center').width(CONTENT_WIDTH - 120).margin(36, 0, 0, 0),

          Text(
            Span(`Certificate ID: ${data.certificateNo}`).color(GRAY),
            Span('  ·  ').color(GOLD),
            Span(`Verify at ${data.verifyUrl}`).color(GRAY),
          ).font('serif').size(10).align('center').margin(20, 0, 0, 0),
        ).alignItems('center').flex(1).justifyContent('center'),
        Row(cornerBracket().scale(1, -1), Column().flex(1), cornerBracket().scale(-1, -1)).justifyContent('space-between'),
      ).flex(1).padding(24).borderWidth(1.5).borderColor(NAVY).margin(20),
    ).width(PAGE_WIDTH).height(PAGE_HEIGHT).bg(CREAM).borderWidth(2).borderColor(GOLD);

    return sone(doc, { width: PAGE_WIDTH, height: PAGE_HEIGHT, background: 'white' }).pdf();
  }
}
