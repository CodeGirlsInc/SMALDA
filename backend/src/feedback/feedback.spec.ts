{
  ;`import { Test, TestingModule } from '@nestjs/testing';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Feedback } from './entities/feedback.entity';
import { FeedbackComment } from './entities/feedback-comment.entity'; // New entity import
import { Repository } from 'typeorm';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { CreateFeedbackCommentDto } from './dto/create-feedback-comment.dto'; // New DTO import
import { UpdateFeedbackCommentDto } from './dto/update-feedback-comment.dto'; // New DTO import
import { FeedbackType } from './enums/feedback-type.enum';
import { FeedbackStatus } from './enums/feedback-status.enum';
import { FeedbackPriority } from './enums/feedback-priority.enum';
import { FeedbackSeverity } from './enums/feedback-severity.enum'; // New enum import
import { FeedbackSource } from './enums/feedback-source.enum'; // New enum import
import { NotFoundException, BadRequestException } from '@nestjs/common';

// Mock Repositories
const mockFeedbackRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  softDelete: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  })),
};

const mockFeedbackCommentRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  delete: jest.fn(),
};

describe('FeedbackService', () => {
  let service: FeedbackService;
  let feedbackRepository: Repository<Feedback>;
  let feedbackCommentRepository: Repository<FeedbackComment>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        {
          provide: getRepositoryToken(Feedback),
          useValue: mockFeedbackRepository,
        },
        {
          provide: getRepositoryToken(FeedbackComment),
          useValue: mockFeedbackCommentRepository,
        },
      ],
    }).compile();

    service = module.get<FeedbackService>(FeedbackService);
    feedbackRepository = module.get<Repository<Feedback>>(getRepositoryToken(Feedback));
    feedbackCommentRepository = module.get<Repository<FeedbackComment>>(getRepositoryToken(FeedbackComment));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new feedback entry', async () => {
      const createDto: CreateFeedbackDto = {
        feedbackType: FeedbackType.BUG_REPORT,
        subject: 'Test Bug',
        message: 'This is a test bug report.',
        userId: 'user-123',
        severity: FeedbackSeverity.HIGH,
        source: FeedbackSource.WEB_APP,
        assignedTo: 'admin-456',
      };
      const expectedFeedback = {
        id: 'feedback-1',
        ...createDto,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: FeedbackStatus.PENDING,
        priority: FeedbackPriority.LOW,
      };

      mockFeedbackRepository.create.mockReturnValue(expectedFeedback);
      mockFeedbackRepository.save.mockResolvedValue(expectedFeedback);

      const result = await service.create(createDto);
      expect(mockFeedbackRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockFeedbackRepository.save).toHaveBeenCalledWith(expectedFeedback);
      expect(result).toEqual(expectedFeedback);
    });
  });

  describe('findAll', () => {
    it('should return all feedback entries with pagination and total count', async () => {
      const feedbackList = [{ id: 'feedback-1', subject: 'Test', comments: [] }];
      mockFeedbackRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([feedbackList, 1]);

      const result = await service.findAll({});
      expect(mockFeedbackRepository.createQueryBuilder).toHaveBeenCalled();
      expect(result).toEqual({ data: feedbackList, total: 1 });
    });

    it('should apply all filters and pagination', async () => {
      const filterDto = {
        feedbackType: FeedbackType.FEATURE_REQUEST,
        status: FeedbackStatus.IN_REVIEW,
        priority: FeedbackPriority.HIGH,
        severity: FeedbackSeverity.CRITICAL,
        source: FeedbackSource.MOBILE_APP,
        userId: 'user-abc',
        assignedTo: 'admin-xyz',
        startDate: '2023-01-01T00:00:00Z',
        endDate: '2023-01-31T23:59:59Z',
        page: 2,
        limit: 5,
        sortBy: 'priority',
        sortOrder: 'ASC',
        search: 'new feature',
      };
      const feedbackList = [{ id: 'feedback-2', subject: 'New Feature Request', comments: [] }];
      mockFeedbackRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([feedbackList, 1]);

      const queryBuilderMock = mockFeedbackRepository.createQueryBuilder();
      const result = await service.findAll(filterDto);

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('feedback.feedbackType = :feedbackType', { feedbackType: FeedbackType.FEATURE_REQUEST });
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('feedback.status = :status', { status: FeedbackStatus.IN_REVIEW });
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('feedback.priority = :priority', { priority: FeedbackPriority.HIGH });
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('feedback.severity = :severity', { severity: FeedbackSeverity.CRITICAL });
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('feedback.source = :source', { source: FeedbackSource.MOBILE_APP });
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('feedback.userId = :userId', { userId: 'user-abc' });
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('feedback.assignedTo = :assignedTo', { assignedTo: 'admin-xyz' });
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('feedback.createdAt >= :startDate', { startDate: new Date('2023-01-01T00:00:00Z') });
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('feedback.createdAt <= :endDate', { endDate: new Date('2023-01-31T23:59:59Z') });
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('(feedback.subject ILIKE :search OR feedback.message ILIKE :search)', { search: '%new feature%' });
      expect(queryBuilderMock.orderBy).toHaveBeenCalledWith('feedback.priority', 'ASC');
      expect(queryBuilderMock.skip).toHaveBeenCalledWith(5);
      expect(queryBuilderMock.take).toHaveBeenCalledWith(5);
      expect(result).toEqual({ data: feedbackList, total: 1 });
    });
  });

  describe('findOne', () => {
    it('should return a feedback entry with comments if found', async () => {
      const feedback = { id: 'feedback-1', subject: 'Test', comments: [{ id: 'comment-1', commentText: 'test comment' }] };
      mockFeedbackRepository.findOne.mockResolvedValue(feedback);

      const result = await service.findOne('feedback-1');
      expect(mockFeedbackRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'feedback-1', deletedAt: null },
        relations: ['comments'],
        order: { comments: { createdAt: 'ASC' } },
      });
      expect(result).toEqual(feedback);
    });

    it('should return undefined if feedback not found', async () => {
      mockFeedbackRepository.findOne.mockResolvedValue(undefined);

      const result = await service.findOne('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update an existing feedback entry', async () => {
      const existingFeedback = { id: 'feedback-1', subject: 'Old Subject', message: 'Old Message', status: FeedbackStatus.PENDING, createdAt: new Date(), updatedAt: new Date(), comments: [] };
      const updateDto: UpdateFeedbackDto = { subject: 'New Subject', status: FeedbackStatus.IN_REVIEW, assignedTo: 'admin-789', resolutionNotes: 'Initial review done.' };
      const updatedFeedback = { ...existingFeedback, ...updateDto };

      mockFeedbackRepository.findOne.mockResolvedValue(existingFeedback);
      mockFeedbackRepository.save.mockResolvedValue(updatedFeedback);

      const result = await service.update('feedback-1', updateDto);
      expect(mockFeedbackRepository.findOne).toHaveBeenCalledWith({ where: { id: 'feedback-1', deletedAt: null }, relations: ['comments'], order: { comments: { createdAt: 'ASC' } } });
      expect(mockFeedbackRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        id: 'feedback-1',
        subject: 'New Subject',
        status: FeedbackStatus.IN_REVIEW,
        assignedTo: 'admin-789',
        resolutionNotes: 'Initial review done.',
      }));
      expect(result).toEqual(updatedFeedback);
    });

    it('should set resolvedAt and resolutionNotes when status changes to RESOLVED', async () => {
      const existingFeedback = { id: 'feedback-1', subject: 'Old Subject', message: 'Old Message', status: FeedbackStatus.PENDING, createdAt: new Date(), updatedAt: new Date(), comments: [] };
      const updateDto: UpdateFeedbackDto = { status: FeedbackStatus.RESOLVED, resolvedBy: 'admin-user', resolutionNotes: 'Issue fixed.' };

      mockFeedbackRepository.findOne.mockResolvedValue(existingFeedback);
      mockFeedbackRepository.save.mockImplementation(async (feedback) => {
        feedback.resolvedAt = new Date(); // Simulate date being set
        return feedback;
      });

      const result = await service.update('feedback-1', updateDto);
      expect(result.status).toEqual(FeedbackStatus.RESOLVED);
      expect(result.resolvedAt).toBeInstanceOf(Date);
      expect(result.resolvedBy).toEqual('admin-user');
      expect(result.resolutionNotes).toEqual('Issue fixed.');
    });

    it('should clear resolvedAt, resolvedBy, and resolutionNotes when status changes from RESOLVED', async () => {
      const existingFeedback = { id: 'feedback-1', subject: 'Old Subject', message: 'Old Message', status: FeedbackStatus.RESOLVED, resolvedAt: new Date(), resolvedBy: 'admin-user', resolutionNotes: 'Old notes', createdAt: new Date(), updatedAt: new Date(), comments: [] };
      const updateDto: UpdateFeedbackDto = { status: FeedbackStatus.IN_REVIEW };

      mockFeedbackRepository.findOne.mockResolvedValue(existingFeedback);
      mockFeedbackRepository.save.mockImplementation(async (feedback) => {
        feedback.resolvedAt = null; // Simulate date being cleared
        feedback.resolvedBy = null;
        feedback.resolutionNotes = null;
        return feedback;
      });

      const result = await service.update('feedback-1', updateDto);
      expect(result.status).toEqual(FeedbackStatus.IN_REVIEW);
      expect(result.resolvedAt).toBeNull();
      expect(result.resolvedBy).toBeNull();
      expect(result.resolutionNotes).toBeNull();
    });

    it('should return undefined if feedback not found for update', async () => {
      mockFeedbackRepository.findOne.mockResolvedValue(undefined);

      const result = await service.update('non-existent-id', { subject: 'New Subject' });
      expect(result).toBeUndefined();
    });
  });

  describe('resolve', () => {
    it('should mark feedback as resolved with notes', async () => {
      const existingFeedback = { id: 'feedback-1', subject: 'Test', status: FeedbackStatus.PENDING, createdAt: new Date(), updatedAt: new Date(), comments: [] };
      const resolvedBy = 'admin-user-id';
      const resolutionNotes = 'Resolved by patching the bug.';

      mockFeedbackRepository.findOne.mockResolvedValue(existingFeedback);
      mockFeedbackRepository.save.mockImplementation(async (feedback) => {
        feedback.status = FeedbackStatus.RESOLVED;
        feedback.resolvedAt = new Date();
        feedback.resolvedBy = resolvedBy;
        feedback.resolutionNotes = resolutionNotes;
        return feedback;
      });

      const result = await service.resolve('feedback-1', resolvedBy, resolutionNotes);
      expect(result.status).toEqual(FeedbackStatus.RESOLVED);
      expect(result.resolvedAt).toBeInstanceOf(Date);
      expect(result.resolvedBy).toEqual(resolvedBy);
      expect(result.resolutionNotes).toEqual(resolutionNotes);
      expect(mockFeedbackRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        id: 'feedback-1',
        status: FeedbackStatus.RESOLVED,
        resolvedBy: resolvedBy,
        resolutionNotes: resolutionNotes,
      }));
    });

    it('should return undefined if feedback not found for resolve', async () => {
      mockFeedbackRepository.findOne.mockResolvedValue(undefined);
      const result = await service.resolve('non-existent-id', 'admin-user');
      expect(result).toBeUndefined();
    });
  });

  describe('assignFeedback', () => {
    it('should assign feedback to a user', async () => {
      const existingFeedback = { id: 'feedback-1', assignedTo: null, comments: [] };
      const assignedTo = 'new-admin-id';
      const updatedFeedback = { ...existingFeedback, assignedTo };

      mockFeedbackRepository.findOne.mockResolvedValue(existingFeedback);
      mockFeedbackRepository.save.mockResolvedValue(updatedFeedback);

      const result = await service.assignFeedback('feedback-1', assignedTo);
      expect(result.assignedTo).toEqual(assignedTo);
      expect(mockFeedbackRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        id: 'feedback-1',
        assignedTo: assignedTo,
      }));
    });

    it('should return undefined if feedback not found for assignment', async () => {
      mockFeedbackRepository.findOne.mockResolvedValue(undefined);
      const result = await service.assignFeedback('non-existent-id', 'new-admin-id');
      expect(result).toBeUndefined();
    });
  });

  describe('unassignFeedback', () => {
    it('should unassign feedback from a user', async () => {
      const existingFeedback = { id: 'feedback-1', assignedTo: 'old-admin-id', comments: [] };
      const updatedFeedback = { ...existingFeedback, assignedTo: null };

      mockFeedbackRepository.findOne.mockResolvedValue(existingFeedback);
      mockFeedbackRepository.save.mockResolvedValue(updatedFeedback);

      const result = await service.unassignFeedback('feedback-1');
      expect(result.assignedTo).toBeNull();
      expect(mockFeedbackRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        id: 'feedback-1',
        assignedTo: null,
      }));
    });

    it('should return undefined if feedback not found for unassignment', async () => {
      mockFeedbackRepository.findOne.mockResolvedValue(undefined);
      const result = await service.unassignFeedback('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('should soft delete a feedback entry', async () => {
      mockFeedbackRepository.softDelete.mockResolvedValue({ affected: 1 });

      const result = await service.remove('feedback-1');
      expect(mockFeedbackRepository.softDelete).toHaveBeenCalledWith('feedback-1');
      expect(result).toBe(true);
    });

    it('should return false if feedback not found for deletion', async () => {
      mockFeedbackRepository.softDelete.mockResolvedValue({ affected: 0 });

      const result = await service.remove('non-existent-id');
      expect(result).toBe(false);
    });
  });

  // --- Feedback Comment Service Tests ---
  describe('createComment', () => {
    it('should create and save a new comment for a feedback', async () => {
      const feedback = { id: 'feedback-1', comments: [] };
      const createCommentDto: CreateFeedbackCommentDto = { commentText: 'New comment', userId: 'user-commenter' };
      const expectedComment = { id: 'comment-1', ...createCommentDto, feedbackId: 'feedback-1', createdAt: new Date(), updatedAt: new Date(), feedback };

      mockFeedbackRepository.findOne.mockResolvedValue(feedback);
      mockFeedbackCommentRepository.create.mockReturnValue(expectedComment);
      mockFeedbackCommentRepository.save.mockResolvedValue(expectedComment);

      const result = await service.createComment('feedback-1', createCommentDto);
      expect(mockFeedbackRepository.findOne).toHaveBeenCalledWith({ where: { id: 'feedback-1', deletedAt: null } });
      expect(mockFeedbackCommentRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        commentText: createCommentDto.commentText,
        userId: createCommentDto.userId,
        feedback: feedback,
      }));
      expect(mockFeedbackCommentRepository.save).toHaveBeenCalledWith(expectedComment);
      expect(result).toEqual(expectedComment);
    });

    it('should throw NotFoundException if feedback not found for comment creation', async () => {
      mockFeedbackRepository.findOne.mockResolvedValue(undefined);
      const createCommentDto: CreateFeedbackCommentDto = { commentText: 'New comment', userId: 'user-commenter' };
      await expect(service.createComment('non-existent-feedback', createCommentDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findCommentsByFeedbackId', () => {
    it('should return all comments for a given feedback ID', async () => {
      const comments = [{ id: 'comment-1', commentText: 'test', feedbackId: 'feedback-1' }];
      mockFeedbackCommentRepository.find.mockResolvedValue(comments);

      const result = await service.findCommentsByFeedbackId('feedback-1');
      expect(mockFeedbackCommentRepository.find).toHaveBeenCalledWith({
        where: { feedback: { id: 'feedback-1' } },
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(comments);
    });
  });

  describe('updateComment', () => {
    it('should update an existing comment', async () => {
      const existingComment = { id: 'comment-1', commentText: 'Old comment', feedbackId: 'feedback-1' };
      const updateCommentDto: UpdateFeedbackCommentDto = { commentText: 'Updated comment' };
      const updatedComment = { ...existingComment, ...updateCommentDto };

      mockFeedbackCommentRepository.findOne.mockResolvedValue(existingComment);
      mockFeedbackCommentRepository.save.mockResolvedValue(updatedComment);

      const result = await service.updateComment('feedback-1', 'comment-1', updateCommentDto);
      expect(mockFeedbackCommentRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'comment-1', feedback: { id: 'feedback-1' } },
      });
      expect(mockFeedbackCommentRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        id: 'comment-1',
        commentText: 'Updated comment',
      }));
      expect(result).toEqual(updatedComment);
    });

    it('should return undefined if comment not found for update', async () => {
      mockFeedbackCommentRepository.findOne.mockResolvedValue(undefined);
      const result = await service.updateComment('feedback-1', 'non-existent-comment', { commentText: 'New' });
      expect(result).toBeUndefined();
    });
  });

  describe('removeComment', () => {
    it('should delete a comment', async () => {
      mockFeedbackCommentRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.removeComment('feedback-1', 'comment-1');
      expect(mockFeedbackCommentRepository.delete).toHaveBeenCalledWith({ id: 'comment-1', feedback: { id: 'feedback-1' } });
      expect(result).toBe(true);
    });

    it('should return false if comment not found for deletion', async () => {
      mockFeedbackCommentRepository.delete.mockResolvedValue({ affected: 0 });

      const result = await service.removeComment('feedback-1', 'non-existent-comment');
      expect(result).toBe(false);
    });
  });
});

describe('FeedbackController', () => {
  let controller: FeedbackController;
  let service: FeedbackService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedbackController],
      providers: [
        {
          provide: FeedbackService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            resolve: jest.fn(),
            assignFeedback: jest.fn(),
            unassignFeedback: jest.fn(),
            remove: jest.fn(),
            createComment: jest.fn(),
            findCommentsByFeedbackId: jest.fn(),
            updateComment: jest.fn(),
            removeComment: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<FeedbackController>(FeedbackController);
    service = module.get<FeedbackService>(FeedbackService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create and return the created feedback', async () => {
      const createDto: CreateFeedbackDto = {
        feedbackType: FeedbackType.GENERAL_INQUIRY,
        subject: 'New Inquiry',
        message: 'Hello',
        severity: FeedbackSeverity.LOW,
        source: FeedbackSource.WEB_APP,
      };
      const expectedFeedback = { id: 'feedback-1', ...createDto };
      jest.spyOn(service, 'create').mockResolvedValue(expectedFeedback as Feedback);

      const result = await controller.create(createDto);
      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(expectedFeedback);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll and return a list of feedback', async () => {
      const filterDto = { page: 1, limit: 10 };
      const feedbackList = { data: [{ id: 'feedback-1', subject: 'Test', comments: [] }], total: 1 };
      jest.spyOn(service, 'findAll').mockResolvedValue(feedbackList as any);

      const result = await controller.findAll(filterDto);
      expect(service.findAll).toHaveBeenCalledWith(filterDto);
      expect(result).toEqual(feedbackList);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne and return a single feedback', async () => {
      const feedback = { id: 'feedback-1', subject: 'Test', comments: [] };
      jest.spyOn(service, 'findOne').mockResolvedValue(feedback as Feedback);

      const result = await controller.findOne('feedback-1');
      expect(service.findOne).toHaveBeenCalledWith('feedback-1');
      expect(result).toEqual(feedback);
    });

    it('should throw NotFoundException if feedback not found', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(undefined);
      await expect(controller.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should call service.update and return the updated feedback', async () => {
      const updateDto: UpdateFeedbackDto = { status: FeedbackStatus.RESOLVED, resolutionNotes: 'Fixed' };
      const updatedFeedback = { id: 'feedback-1', subject: 'Test', status: FeedbackStatus.RESOLVED, resolutionNotes: 'Fixed', comments: [] };
      jest.spyOn(service, 'update').mockResolvedValue(updatedFeedback as Feedback);

      const result = await controller.update('feedback-1', updateDto);
      expect(service.update).toHaveBeenCalledWith('feedback-1', updateDto);
      expect(result).toEqual(updatedFeedback);
    });

    it('should throw NotFoundException if feedback not found for update', async () => {
      jest.spyOn(service, 'update').mockResolvedValue(undefined);
      await expect(controller.update('non-existent-id', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('resolve', () => {
    it('should call service.resolve and return the resolved feedback', async () => {
      const resolvedBy = 'admin-user';
      const resolutionNotes = 'Issue fixed.';
      const resolvedFeedback = { id: 'feedback-1', subject: 'Test', status: FeedbackStatus.RESOLVED, resolvedBy, resolutionNotes, comments: [] };
      jest.spyOn(service, 'resolve').mockResolvedValue(resolvedFeedback as Feedback);

      const result = await controller.resolve('feedback-1', resolvedBy, resolutionNotes);
      expect(service.resolve).toHaveBeenCalledWith('feedback-1', resolvedBy, resolutionNotes);
      expect(result).toEqual(resolvedFeedback);
    });

    it('should throw BadRequestException if resolvedBy is missing', async () => {
      await expect(controller.resolve('feedback-1', undefined, 'notes')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if feedback not found for resolve', async () => {
      jest.spyOn(service, 'resolve').mockResolvedValue(undefined);
      await expect(controller.resolve('non-existent-id', 'admin-user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('assign', () => {
    it('should call service.assignFeedback and return the assigned feedback', async () => {
      const assignedTo = 'admin-user-id';
      const assignedFeedback = { id: 'feedback-1', assignedTo, comments: [] };
      jest.spyOn(service, 'assignFeedback').mockResolvedValue(assignedFeedback as Feedback);

      const result = await controller.assign('feedback-1', assignedTo);
      expect(service.assignFeedback).toHaveBeenCalledWith('feedback-1', assignedTo);
      expect(result).toEqual(assignedFeedback);
    });

    it('should throw BadRequestException if assignedTo is missing', async () => {
      await expect(controller.assign('feedback-1', undefined)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if feedback not found for assignment', async () => {
      jest.spyOn(service, 'assignFeedback').mockResolvedValue(undefined);
      await expect(controller.assign('non-existent-id', 'admin-user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('unassign', () => {
    it('should call service.unassignFeedback and return the unassigned feedback', async () => {
      const unassignedFeedback = { id: 'feedback-1', assignedTo: null, comments: [] };
      jest.spyOn(service, 'unassignFeedback').mockResolvedValue(unassignedFeedback as Feedback);

      const result = await controller.unassign('feedback-1');
      expect(service.unassignFeedback).toHaveBeenCalledWith('feedback-1');
      expect(result).toEqual(unassignedFeedback);
    });

    it('should throw NotFoundException if feedback not found for unassignment', async () => {
      jest.spyOn(service, 'unassignFeedback').mockResolvedValue(undefined);
      await expect(controller.unassign('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should call service.remove and return nothing on success', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue(true);
      const result = await controller.remove('feedback-1');
      expect(service.remove).toHaveBeenCalledWith('feedback-1');
      expect(result).toBeUndefined(); // No content response
    });

    it('should throw NotFoundException if feedback not found for removal', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue(false);
      await expect(controller.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  // --- Feedback Comment Controller Tests ---
  describe('addComment', () => {
    it('should add a comment to a feedback entry', async () => {
      const createCommentDto: CreateFeedbackCommentDto = { commentText: 'New comment', userId: 'user-commenter' };
      const feedback = { id: 'feedback-1', comments: [] };
      const expectedComment = { id: 'comment-1', ...createCommentDto, feedbackId: 'feedback-1' };

      jest.spyOn(service, 'findOne').mockResolvedValue(feedback as Feedback);
      jest.spyOn(service, 'createComment').mockResolvedValue(expectedComment as FeedbackComment);

      const result = await controller.addComment('feedback-1', createCommentDto);
      expect(service.findOne).toHaveBeenCalledWith('feedback-1');
      expect(service.createComment).toHaveBeenCalledWith('feedback-1', createCommentDto);
      expect(result).toEqual(expectedComment);
    });

    it('should throw NotFoundException if feedback not found for adding comment', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(undefined);
      const createCommentDto: CreateFeedbackCommentDto = { commentText: 'New comment', userId: 'user-commenter' };
      await expect(controller.addComment('non-existent-feedback', createCommentDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getComments', () => {
    it('should return all comments for a feedback entry', async () => {
      const feedback = { id: 'feedback-1', comments: [] };
      const comments = [{ id: 'comment-1', commentText: 'test', feedbackId: 'feedback-1' }];

      jest.spyOn(service, 'findOne').mockResolvedValue(feedback as Feedback);
      jest.spyOn(service, 'findCommentsByFeedbackId').mockResolvedValue(comments as FeedbackComment[]);

      const result = await controller.getComments('feedback-1');
      expect(service.findOne).toHaveBeenCalledWith('feedback-1');
      expect(service.findCommentsByFeedbackId).toHaveBeenCalledWith('feedback-1');
      expect(result).toEqual(comments);
    });

    it('should throw NotFoundException if feedback not found for getting comments', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(undefined);
      await expect(controller.getComments('non-existent-feedback')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateComment', () => {
    it('should update a specific comment', async () => {
      const updateCommentDto: UpdateFeedbackCommentDto = { commentText: 'Updated comment' };
      const updatedComment = { id: 'comment-1', commentText: 'Updated comment', feedbackId: 'feedback-1' };

      jest.spyOn(service, 'updateComment').mockResolvedValue(updatedComment as FeedbackComment);

      const result = await controller.updateComment('feedback-1', 'comment-1', updateCommentDto);
      expect(service.updateComment).toHaveBeenCalledWith('feedback-1', 'comment-1', updateCommentDto);
      expect(result).toEqual(updatedComment);
    });

    it('should throw NotFoundException if comment not found for update', async () => {
      jest.spyOn(service, 'updateComment').mockResolvedValue(undefined);
      await expect(controller.updateComment('feedback-1', 'non-existent-comment', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeComment', () => {
    it('should remove a specific comment', async () => {
      jest.spyOn(service, 'removeComment').mockResolvedValue(true);
      const result = await controller.removeComment('feedback-1', 'comment-1');
      expect(service.removeComment).toHaveBeenCalledWith('feedback-1', 'comment-1');
      expect(result).toBeUndefined(); // No content response
    });

    it('should throw NotFoundException if comment not found for removal', async () => {
      jest.spyOn(service, 'removeComment').mockResolvedValue(false);
      await expect(controller.removeComment('feedback-1', 'non-existent-comment')).rejects.toThrow(NotFoundException);
    });
  });
});`
}
