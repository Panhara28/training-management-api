import type { Prisma } from '@prisma/client';
import { ParticipantsService } from './participants.service';
import type { PrismaService } from '../prisma/prisma.service';

function makeService() {
  const prisma = {
    user: {
      count: jest.fn<Promise<number>, [Prisma.UserCountArgs]>().mockResolvedValue(0),
      findMany: jest.fn<Promise<unknown[]>, [Prisma.UserFindManyArgs]>().mockResolvedValue([]),
    },
  };
  return { service: new ParticipantsService(prisma as unknown as PrismaService), prisma };
}

const findManyArgs = (prisma: ReturnType<typeof makeService>['prisma']) => prisma.user.findMany.mock.calls[0][0];

describe('ParticipantsService', () => {
  it('filters to participants enrolled in the selected training, server-side', async () => {
    const { service, prisma } = makeService();
    await service.list({ sessionId: 'session-1' });
    const where = findManyArgs(prisma).where;
    expect(where).toMatchObject({ role: 'PARTICIPANT', enrollments: { some: { sessionId: 'session-1' } } });
    expect(prisma.user.count.mock.calls[0][0].where).toEqual(where);
  });

  it('searches English name, Khmer name, email, username and phone', async () => {
    const { service, prisma } = makeService();
    await service.list({ search: '  dara ' });
    const fields = (findManyArgs(prisma).where?.OR ?? []).map((c) => Object.keys(c)[0]);
    expect(fields).toEqual(['fullName', 'fullNameKh', 'email', 'username', 'phoneNumber']);
  });

  it('paginates and caps the page size', async () => {
    const { service, prisma } = makeService();
    const res = await service.list({ page: 3, pageSize: 10_000 });
    const args = findManyArgs(prisma);
    expect(args.take).toBe(500);
    expect(args.skip).toBe(1000);
    expect(res).toMatchObject({ page: 3, pageSize: 500, total: 0 });
  });

  it('exports with the same filters as the list and without pagination', async () => {
    const { service, prisma } = makeService();
    prisma.user.findMany.mockResolvedValue([
      {
        fullName: 'Sok Dara',
        fullNameKh: 'សុខ ដារ៉ា',
        username: 'sok.dara',
        email: 'sok@moc.gov.kh',
        gender: 'MALE',
        phoneNumber: '012345678',
        currentRole: 'Officer',
        generalDepartment: 'Dept of Trade',
        departmentOffice: 'Phnom Penh',
        department: null,
        enrollments: [{ session: { title: 'Leadership', titleKh: null } }],
        createdAt: new Date('2026-09-06T00:00:00Z'),
      },
    ]);
    const csv = await service.exportCsv({ sessionId: 'session-1', departmentId: 'dept-1' });
    const args = findManyArgs(prisma);
    expect(args.where).toMatchObject({ departmentId: 'dept-1', enrollments: { some: { sessionId: 'session-1' } } });
    expect(args.take).toBeUndefined();
    expect(csv).toContain('សុខ ដារ៉ា');
    expect(csv).toContain('Leadership');
  });
});
