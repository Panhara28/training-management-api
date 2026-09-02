import { Injectable } from '@nestjs/common';
import path from 'node:path';
import { Column, Row, Text, Span, Photo, Table, TableRow, TableCell, sone, qrcode, Font } from 'sone';
import { toKhmerNumeral } from '../lib/khmer-date';

const PAGE_WIDTH = 816; // US Letter @ 96dpi
const PAGE_HEIGHT = 1056;
const MARGIN = { top: 58, bottom: 24, left: 77, right: 67 };
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN.left - MARGIN.right;

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts');

const kn = toKhmerNumeral;

// Fixed organizational roster — Ministry of Commerce departments/institutes invited to every session.
const DEPARTMENTS = [
  'នាយកដ្ឋានរដ្ឋបាល', 'នាយកដ្ឋានធនធានមនុស្ស', 'នាយកដ្ឋានហិរញ្ញវត្ថុ', 'នាយកដ្ឋានផែនការ និងស្ថិតិ',
  'នាយកដ្ឋានកិច្ចការអាស៊ាន', 'នាយកដ្ឋានកិច្ចការអាស៊ីប៉ាស៊ីហ្វិក', 'នាយកដ្ឋានកិច្ចការអឺរ៉ុប មជ្ឈិមបូព៌ា និងអាហ្រ្វិក',
  'នាយកដ្ឋានកិច្ចការអាមេរិក', 'នាយកដ្ឋានកិច្ចការអង្គការពាណិជ្កម្មពិភពលោកនិងអង្គការអន្តរជាតិ',
  'នាយកដ្ឋានទំនាក់ទំនង និងសហប្រតិបត្តិការអន្តរជាតិ', 'នាយកដ្ឋានអភិវឌ្ឍន៍វិស័យឯកជន និងទីផ្សារ',
  'នាយកដ្ឋានចុះបញ្ជីពាណិជ្ជកម្ម', 'នាយកដ្ឋានកិច្ចការហាឡាល', 'នាយកដ្ឋានកម្មសិទ្ធិបញ្ញា', 'នាយកដ្ឋាននាំចេញ នាំចូល',
  'នាយកដ្ឋានគ្រប់គ្រងការនាំចេញក្នុងតំបន់សេដ្ឋកិច្ចពិសេស', 'នាយកដ្ឋានគោលនយោបាយពាណិជ្ជកម្ម', 'នាយកដ្ឋាននីតិកម្ម',
  'នាយកដ្ឋានអភិវឌ្ឍន៍ពាណិជ្ជកម្មឌីជីថល', 'នាយកដ្ឋានជំរុញពាណិជ្ជកម្មនិងកិច្ចការពិព័រណ៍',
  'នាយកដ្ឋានកិច្ចការពារអ្នកប្រើប្រាស់ និងការប្រកួតប្រជែង', 'នាយកដ្ឋានកិច្ចការប្រកួតប្រជែង',
  'នាយកដ្ឋានកិច្ចការបច្ចេកទេស និងមន្ទីរពិសោធន៍', 'នាយកដ្ឋានសវនកម្មផ្ទៃក្នុង',
  'នាយកដ្ឋានទទួលពាក្យបណ្ដឹង និងដោះស្រាយវិវាទ', 'វិទ្យាស្ថានបណ្ដុះបណ្ដាលពាណិជ្ជកម្មនិងស្រាវជ្រាវ',
];
const PROVINCE_OFFICIALS_COUNT = 50;
const TOTAL_PARTICIPANTS = DEPARTMENTS.length * 2 + PROVINCE_OFFICIALS_COUNT;

export type TrainingInvitationData = {
  subjectTitle: string;
  sessionDateText: string;
  sessionTimeText: string;
  venueText: string;
  presidingOfficial: string;
  issuedDateText: string;
  lunarDateText: string;
  telegramLink: string;
  contactPhone: string;
  replyDeadlineText: string;
  signerName: string;
  signerTitle: string;
  referenceNo: string;
};

function LetterHead(referenceNo: string) {
  return Row(
    Column(
      Text('ក្រសួងពាណិជ្ជកម្ម').font('Khmer OS Muol Light').size(15).color('#000'),
      Text('វិទ្យាស្ថានបណ្ដុះបណ្ដាលពាណិជ្ជកម្មនិងស្រាវជ្រាវ').font('Khmer OS Siemreap').size(11).color('#000'),
      Text(`លេខ: ${referenceNo}`).font('Khmer OS Siemreap').size(11).color('#000'),
    ).gap(2),
    Column(
      Text('ព្រះរាជាណាចក្រកម្ពុជា').font('Khmer OS Muol Light').size(13).lineHeight(1).color('#000').align('center'),
      Text('ជាតិ សាសនា ព្រះមហាក្សត្រ').font('Khmer OS Muol Light').size(11).lineHeight(1).color('#000').align('center'),
    ).gap(2).alignItems('center').margin(0, 0, 0, 0),
  ).justifyContent('space-between').alignItems('flex-start').width(CONTENT_WIDTH);
}

function FieldRow(label: string, value: string) {
  return Row(
    Text(
      Span(label).font('Khmer OS Muol Light'),
      Span('៖').font('Khmer OS Siemreap'),
    ).size(12).color('#000').width(64),
    Text(value).font('Khmer OS Siemreap').size(12).color('#000').flex(1).align('justify'),
  ).gap(4);
}

@Injectable()
export class TrainingInvitationDocumentService {
  private fontsLoaded = false;

  private async ensureFontsLoaded() {
    if (this.fontsLoaded) return;
    await Font.load('Khmer OS Siemreap', path.join(FONT_DIR, 'KhmerOS_siemreap.ttf'));
    await Font.load('Khmer OS Muol Light', path.join(FONT_DIR, 'KhmerOS_muollight.ttf'));
    this.fontsLoaded = true;
  }

  async buildTrainingInvitationPdf(data: TrainingInvitationData): Promise<Buffer> {
    await this.ensureFontsLoaded();

    const page1 = Column(
      LetterHead(data.referenceNo),
      Column(
        Text('សូមគោរពជូន').font('Khmer OS Muol Light').size(14).underline().color('#000'),
        Text('ឯកឧត្តមអគ្គលេខាធិការនៃអគ្គលេខាធិការដ្ឋាន').font('Khmer OS Muol Light').size(13).color('#000'),
      ).alignItems('center').gap(4).margin(16, 0),

      Column(
        FieldRow('កម្មវត្ថុ', `សំណើសុំជួយសម្រួលក្នុងវគ្គបណ្ដុះបណ្ដាលស្ដីពី "${data.subjectTitle}"។`),
        FieldRow('យោង', 'ចំណារដ៏ខ្ពង់ខ្ពស់របស់ ឯកឧត្តមទេសរដ្ឋមន្ត្រី។'),
        FieldRow('ជូនភ្ជាប់', 'របៀបវារៈនៃវគ្គបណ្ដុះបណ្ដាល។'),
      ).gap(6).margin(0, 0, 12, 0),

      Text(
        'សេចក្តីដូចមានចែងក្នុងកម្មវត្ថុ និងយោងខាងលើ ខ្ញុំបាទ/នាងខ្ញុំសូមគោរពជម្រាបជូន ឯកឧត្តម មេត្តាជ្រាបថា ',
        Span('វិទ្យាស្ថានបណ្ដុះបណ្ដាលពាណិជ្ជកម្មនិងស្រាវជ្រាវ').weight('bold'),
        ` នឹងរៀបចំវគ្គបណ្ដុះបណ្ដាលស្ដីពី "${data.subjectTitle}" ដែលនឹងប្រព្រឹត្តទៅនៅ${data.sessionDateText} វេលា${data.sessionTimeText} នៅ${data.venueText} ក្រោមអធិបតីភាព ${data.presidingOfficial} ដោយមានការចូលរួមពីមន្រ្តីរាជការសរុបចំនួន ${kn(TOTAL_PARTICIPANTS)} នាក់។`,
      ).font('Khmer OS Siemreap').size(12).lineHeight(1.67).align('justify').indent(76),

      Text(
        'ដើម្បីឱ្យការរៀបចំវគ្គបណ្ដុះបណ្ដាលនេះប្រព្រឹត្តទៅដោយរលូន និងជោគជ័យ ខ្ញុំបាទ/នាងខ្ញុំសូមគោរពស្នើសុំ ឯកឧត្តម មេត្តាជួយសម្របសម្រួលកិច្ចការ ដូចខាងក្រោម៖',
      ).font('Khmer OS Siemreap').size(12).lineHeight(1.67).align('justify').indent(76).margin(8, 0, 0, 0),

      Column(
        Text('១- ស្នើសុំសាលប្រជុំ ផ្កា និងទឹកសុទ្ធ សម្រាប់វគ្គបណ្ដុះបណ្ដាលខាងលើ។').font('Khmer OS Siemreap').size(12).lineHeight(1.67).indent(92),
        Text('២- ជួយសម្របសម្រួលអញ្ជើញមន្ត្រីរាជការក្រសួងពាណិជ្ជកម្ម ដើម្បីចូលរួមវគ្គបណ្ដុះបណ្ដាល ដូចមានជូនភ្ជាប់មកជាមួយ។').font('Khmer OS Siemreap').size(12).lineHeight(1.67).indent(85),
      ).gap(4).margin(8, 0, 0, 24),

      Text(
        'សេចក្ដីដូចបានជម្រាបជូនខាងលើ សូម ឯកឧត្តម មេត្តាជួយសម្របសម្រួលក្នុងការរៀបចំវគ្គបណ្ដុះបណ្ដាលខាងលើ ដោយក្ដីអនុគ្រោះ។',
      ).font('Khmer OS Siemreap').size(12).lineHeight(1.67).align('justify').indent(76).margin(8, 0, 0, 0),

      Text(
        'សូម ឯកឧត្តមអគ្គលេខាធិការ មេត្តា ទទួលនូវការគោរពដ៏ស្មោះស្ម័គ្រពីខ្ញុំបាទ/នាងខ្ញុំ៕',
      ).font('Khmer OS Siemreap').size(12).lineHeight(1.67).align('justify').indent(76).margin(4, 0, 0, 0),

      Row(
        Column(
          Text(data.lunarDateText).font('Khmer OS Siemreap').size(12).align('center'),
          Text(data.issuedDateText).font('Khmer OS Siemreap').size(12).align('center'),
          Text(data.signerTitle).font('Khmer OS Siemreap').size(12).weight('bold').align('center').margin(4, 0, 0, 0),
          Column().height(48),
          Text(data.signerName).font('Khmer OS Siemreap').size(12).weight('bold').align('center'),
        ).alignItems('center'),
      ).justifyContent('flex-end').margin(24, 0, 0, 0),
    ).gap(10).width(CONTENT_WIDTH);

    const COL1_WIDTH = 83;
    const COL3_WIDTH = 91;

    const tableHeaderRow = TableRow(
      TableCell(Text('ល.រ.').font('Khmer OS Siemreap').size(11).weight('bold').align('center')).width(COL1_WIDTH).padding(6).borderWidth(1).borderColor('#000').bg('#f2f2f2'),
      TableCell(Text('ឈ្មោះនាយកដ្ឋាន/វិទ្យាស្ថាន/មន្ទីរ').font('Khmer OS Siemreap').size(11).weight('bold').align('center')).flex(1).padding(6).borderWidth(1).borderColor('#000').bg('#f2f2f2'),
      TableCell(Text('ចំនួនមន្ត្រី').font('Khmer OS Siemreap').size(11).weight('bold').align('center')).width(COL3_WIDTH).padding(6).borderWidth(1).borderColor('#000').bg('#f2f2f2'),
    );

    const deptRows = DEPARTMENTS.map((name, i) =>
      TableRow(
        TableCell(Text(kn(i + 1)).font('Khmer OS Siemreap').size(11).align('center')).width(COL1_WIDTH).padding(5).borderWidth(1).borderColor('#000'),
        TableCell(Text(name).font('Khmer OS Siemreap').size(11)).flex(1).padding(5).borderWidth(1).borderColor('#000'),
        TableCell(Text(kn(2)).font('Khmer OS Siemreap').size(11).align('center')).width(COL3_WIDTH).padding(5).borderWidth(1).borderColor('#000'),
      ),
    );

    const provinceRow = TableRow(
      TableCell(Text(kn(DEPARTMENTS.length + 1)).font('Khmer OS Siemreap').size(11).align('center')).width(COL1_WIDTH).padding(5).borderWidth(1).borderColor('#000'),
      TableCell(Text('មន្ទីរពាណិជ្ជកម្មរាជធានី-ខេត្តទាំង២៥ (២នាក់ក្នុងមួយមន្ទីរ)').font('Khmer OS Siemreap').size(11)).flex(1).padding(5).borderWidth(1).borderColor('#000'),
      TableCell(Text(kn(PROVINCE_OFFICIALS_COUNT)).font('Khmer OS Siemreap').size(11).align('center')).width(COL3_WIDTH).padding(5).borderWidth(1).borderColor('#000'),
    );

    const totalRow = TableRow(
      TableCell(Text('សរុប').font('Khmer OS Siemreap').size(12).weight('bold').align('center')).colspan(2).flex(1).padding(6).borderWidth(1).borderColor('#000').bg('#f2f2f2'),
      TableCell(Text(kn(TOTAL_PARTICIPANTS)).font('Khmer OS Siemreap').size(12).weight('bold').align('center')).width(COL3_WIDTH).padding(6).borderWidth(1).borderColor('#000').bg('#f2f2f2'),
    );

    const page2 = Column(
      Text('បញ្ជីឈ្មោះនាយកដ្ឋាន វិទ្យាស្ថាន និងមន្ទីរ នៃក្រសួងពាណិជ្ជកម្មដែលត្រូវអញ្ជើញចូលរួម')
        .font('Khmer OS Muol Light').size(13).align('center').margin(0, 0, 12, 0),
      Table(tableHeaderRow, ...deptRows, provinceRow, totalRow).width(CONTENT_WIDTH),
    ).width(CONTENT_WIDTH);

    const qrBuf = qrcode(data.telegramLink, { pixelSize: 6 });

    const page3note = Column(
      Text(
        Span('បញ្ជាក់៖').weight('bold').underline(),
        ` សូមធ្វើការឆ្លើយតបជូនដំណឹងមកវិទ្យាស្ថានឱ្យបានមុន${data.replyDeadlineText} តាមរយៈទូរស័ព្ទលេខ ${data.contactPhone} និងសូមសិក្ខាកាមចូលក្រុម Telegram ដើម្បីទទួលបានព័ត៌មាន និងឯកសារមេរៀន តាមរយៈតំណភ្ជាប់ ឬ QR កូដ ខាងក្រោម៖`,
      ).font('Khmer OS Siemreap').size(11.5).lineHeight(1.67).align('justify'),
      Column(
        Text(`- តំណភ្ជាប់ ៖ ${data.telegramLink}`).font('Khmer OS Siemreap').size(11.5),
        Row(
          Text('- QR Code ៖').font('Khmer OS Siemreap').size(11.5),
          Photo(qrBuf).size(110, 110),
        ).gap(8).alignItems('center'),
      ).gap(8).margin(8, 0, 0, 16),
    ).gap(8).margin(16, 0, 0, 0).width(CONTENT_WIDTH);

    const doc = Column(page1, Column().height(24), page2, page3note).padding(0);

    return sone(doc, {
      width: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
      margin: MARGIN,
      lastPageHeight: 'content',
      background: 'white',
    }).pdf();
  }
}
