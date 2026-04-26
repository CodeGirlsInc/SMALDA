import { UsersService } from './users.service';

// Mock dependency representing a generic database repository or ORM
const mockUserRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
};

describe('UsersService', () => {
  let usersService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Assuming a typical dependency injection pattern
    usersService = new UsersService(mockUserRepository);
  });

  describe('create()', () => {
    it('creates and returns user record', async () => {
      const userData = { email: 'test@example.com', password: 'hashedpassword' };
      const createdUser = { id: 1, ...userData };

      mockUserRepository.create.mockReturnValue(createdUser);
      mockUserRepository.save.mockResolvedValue(createdUser);

      const result = await usersService.create(userData);

      expect(mockUserRepository.create).toHaveBeenCalledWith(userData);
      expect(mockUserRepository.save).toHaveBeenCalledWith(createdUser);
      expect(result).toEqual(createdUser);
    });
  });

  describe('findById()', () => {
    it('returns user when found', async () => {
      const user = { id: 1, email: 'test@example.com' };
      mockUserRepository.findOne.mockResolvedValue(user);

      const result = await usersService.findById(1);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(user);
    });

    it('returns null when not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await usersService.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByEmail()', () => {
    it('returns user when found', async () => {
      const user = { id: 1, email: 'test@example.com' };
      mockUserRepository.findOne.mockResolvedValue(user);

      const result = await usersService.findByEmail('test@example.com');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(result).toEqual(user);
    });

    it('returns null when not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await usersService.findByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  describe('update()', () => {
    it('applies partial updates and returns updated entity', async () => {
      const existingUser = { id: 1, email: 'test@example.com', name: 'Old Name' };
      const updates = { name: 'New Name' };
      const updatedUser = { ...existingUser, ...updates };

      mockUserRepository.findOne.mockResolvedValue(existingUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);

      const result = await usersService.update(1, updates);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockUserRepository.save).toHaveBeenCalledWith(updatedUser);
      expect(result).toEqual(updatedUser);
    });
  });

  describe('softDelete()', () => {
    it('sets deletedAt without removing the row', async () => {
      const existingUser = { id: 1, email: 'test@example.com', deletedAt: null };
      mockUserRepository.findOne.mockResolvedValue(existingUser);

      // Using mock implementation to verify the mutation logic of soft delete
      mockUserRepository.save.mockImplementation(async (user) => user);

      const result = await usersService.softDelete(1);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockUserRepository.save).toHaveBeenCalled();
      
      // Ensure the row is not deleted from the database but merely marked as deleted
      expect(result.deletedAt).toBeInstanceOf(Date);
      expect(mockUserRepository.update).not.toHaveBeenCalled(); // Ensure no hard delete/update equivalent is improperly used if `save` handles it
    });
  });
});
