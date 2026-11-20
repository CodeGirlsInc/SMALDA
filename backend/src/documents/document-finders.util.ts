/** #1559: the lookups DocumentsService callers rely on (findById, findByOwner, findByFileHash, paginated). */
type Repo<T> = {
  findOne(opts: object): Promise<T | null>;
  find(opts: object): Promise<T[]>;
  findAndCount(opts: object): Promise<[T[], number]>;
};

export const findById = <T>(repo: Repo<T>, id: string) => repo.findOne({ where: { id } });

export const findByFileHash = <T>(repo: Repo<T>, fileHash: string, ownerId?: string) =>
  repo.findOne({ where: ownerId ? { fileHash, ownerId } : { fileHash } });

export const findByOwner = <T>(repo: Repo<T>, ownerId: string) =>
  repo.find({ where: { ownerId }, order: { createdAt: 'DESC' } });

export async function findByOwnerPaginated<T>(repo: Repo<T>, ownerId: string, page = 1, limit = 20) {
  const take = Math.min(100, Math.max(1, limit));
  const [data, total] = await repo.findAndCount({
    where: { ownerId },
    order: { createdAt: 'DESC' },
    skip: (Math.max(1, page) - 1) * take,
    take,
  });
  return { data, total, page, limit: take };
}
