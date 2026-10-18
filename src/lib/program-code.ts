import { Prisma, PrismaClient } from '@prisma/client';

// Program codes are generated server-side only — never accepted from the
// client — so two staff members submitting at the same moment can't collide,
// and the field can be read-only in the UI.

function categoryCodePrefix(category: string): string {
  const words = category.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const initials = words.map((w) => w[0]?.toUpperCase() ?? '').join('');
    return (initials.slice(0, 4) || 'GEN').padEnd(2, 'X');
  }
  const word = (words[0] ?? '').replace(/[^a-zA-Z]/g, '');
  return (word.slice(0, 3).toUpperCase() || 'GEN').padEnd(2, 'X');
}

/** A non-authoritative preview for display before the form is submitted. */
export async function previewProgramCode(
  prisma: Pick<PrismaClient, 'trainingProgram'>,
  category: string,
): Promise<string> {
  const prefix = categoryCodePrefix(category);
  const count = await prisma.trainingProgram.count({ where: { code: { startsWith: `${prefix}-` } } });
  return `${prefix}-${String(count + 1).padStart(2, '0')}`;
}

type ProgramCreateInput = Omit<Prisma.TrainingProgramUncheckedCreateInput, 'code' | 'category'>;

/**
 * Creates a TrainingProgram with a freshly generated, guaranteed-unique code.
 * Retries on a unique-constraint collision (two concurrent submissions
 * racing for the same next sequence number) instead of trusting a
 * read-then-write count.
 */
export async function createProgramWithGeneratedCode<
  Tx extends { trainingProgram: Pick<PrismaClient['trainingProgram'], 'count' | 'create'> },
>(tx: Tx, category: string, data: ProgramCreateInput) {
  const prefix = categoryCodePrefix(category);
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const count = await tx.trainingProgram.count({ where: { code: { startsWith: `${prefix}-` } } });
    const code = `${prefix}-${String(count + 1 + attempt).padStart(2, '0')}`;
    try {
      return await tx.trainingProgram.create({ data: { ...data, code, category } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new Error('Could not generate a unique program code after multiple attempts.');
}
