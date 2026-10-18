import { Prisma } from '@prisma/client';
import { createProgramWithGeneratedCode, previewProgramCode } from './program-code';

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: Prisma.prismaVersion.client,
  });
}

function fakeTx(existingWithPrefix: number, create: jest.Mock) {
  return {
    trainingProgram: {
      count: jest.fn().mockResolvedValue(existingWithPrefix),
      create,
    },
  };
}

const data = { title: 'T', titleKh: null, description: null, durationDays: 1 };

describe('previewProgramCode', () => {
  it.each([
    ['Leadership', 0, 'LEA-01'],
    ['Finance', 4, 'FIN-05'],
    ['Public Speaking', 0, 'PS-01'],
    ['Trade Policy And Law', 9, 'TPAL-10'],
    ['ភាពជាអ្នកដឹកនាំ', 0, 'GEN-01'],
  ])('category %s with %d existing codes -> %s', async (category, existing, expected) => {
    const tx = fakeTx(existing, jest.fn());
    await expect(previewProgramCode(tx as never, category)).resolves.toBe(expected);
  });
});

describe('createProgramWithGeneratedCode', () => {
  it('creates with the next sequence number and the given category', async () => {
    const create = jest.fn().mockImplementation(({ data: d }: { data: unknown }) => Promise.resolve(d));
    const result = await createProgramWithGeneratedCode(fakeTx(2, create), 'Finance', data);
    expect(result).toMatchObject({ code: 'FIN-03', category: 'Finance', title: 'T' });
  });

  it('retries with the next number when a concurrent submission took the code', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(uniqueViolation())
      .mockImplementation(({ data: d }: { data: unknown }) => Promise.resolve(d));
    const result = await createProgramWithGeneratedCode(fakeTx(2, create), 'Finance', data);
    expect(create).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ code: 'FIN-04' });
  });

  it('does not swallow errors other than a unique-constraint collision', async () => {
    const create = jest.fn().mockRejectedValue(new Error('db down'));
    await expect(createProgramWithGeneratedCode(fakeTx(0, create), 'Finance', data)).rejects.toThrow('db down');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('gives up after repeated collisions instead of looping forever', async () => {
    const create = jest.fn().mockRejectedValue(uniqueViolation());
    await expect(createProgramWithGeneratedCode(fakeTx(0, create), 'Finance', data)).rejects.toThrow();
    expect(create).toHaveBeenCalledTimes(25);
  });
});
