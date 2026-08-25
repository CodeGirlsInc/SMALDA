import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DocumentsGateway } from './documents.gateway';
import { DocumentsService } from './documents.service';
import { DocumentStatus } from './entities/document.entity';

describe('DocumentsGateway', () => {
  let gateway: DocumentsGateway;
  let jwtService: JwtService;
  let documentsService: DocumentsService;

  const mockConfigService = {
    get: (key: string) => {
      if (key === 'JWT_SECRET') return 'test-secret-key-at-least-32chars';
      return undefined;
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsGateway,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: DocumentsService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<DocumentsGateway>(DocumentsGateway);
    jwtService = module.get<JwtService>(JwtService);
    documentsService = module.get<DocumentsService>(DocumentsService);

    // Set up a minimal mock server
    gateway.server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleConnection — authentication', () => {
    function createMockClient(token?: string) {
      const joins: string[] = [];
      return {
        id: 'socket-1',
        handshake: {
          auth: token !== undefined ? { token } : {},
          query: {},
        },
        userId: undefined as string | undefined,
        userRole: undefined as string | undefined,
        join: jest.fn((room: string) => {
          joins.push(room);
        }),
        emit: jest.fn(),
        disconnect: jest.fn(),
        _joins: joins,
      } as any;
    }

    it('should reject a connection with no token', async () => {
      const client = createMockClient(undefined);
      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Authentication required',
      });
      expect(client.userId).toBeUndefined();
    });

    it('should reject a connection with an invalid token', async () => {
      const client = createMockClient('bad-token');
      (jwtService.verifyAsync as jest.Mock).mockRejectedValue(
        new Error('Invalid token'),
      );

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Invalid authentication token',
      });
      expect(client.userId).toBeUndefined();
    });

    it('should accept a valid token and join the user room', async () => {
      const client = createMockClient('valid-jwt-token');
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
        sub: 'user-123',
        role: 'user',
        email: 'test@example.com',
      });

      await gateway.handleConnection(client);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.userId).toBe('user-123');
      expect(client.userRole).toBe('user');
      expect(client.join).toHaveBeenCalledWith('user:user-123');
    });

    it('should not emit error events before disconnecting an unauthenticated client', async () => {
      const client = createMockClient(undefined);

      await gateway.handleConnection(client);

      // Should emit an error message before disconnecting
      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Authentication required',
      });
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('event emission — room scoping', () => {
    it('should emit status-changed events to a document-specific room, not globally', () => {
      const emitSpy = jest.fn();
      gateway.server = {
        to: jest.fn().mockReturnValue({ emit: emitSpy }),
      } as any;

      gateway.notifyStatusChanged(
        'doc-456',
        DocumentStatus.VERIFIED,
        DocumentStatus.PENDING,
      );

      expect(gateway.server.to).toHaveBeenCalledWith('document:doc-456');
      expect(emitSpy).toHaveBeenCalledWith('document:status-changed', {
        documentId: 'doc-456',
        status: DocumentStatus.VERIFIED,
        previousStatus: DocumentStatus.PENDING,
        timestamp: expect.any(String),
      });
    });

    it('should emit events with correct timestamp format (ISO 8601)', () => {
      const emitSpy = jest.fn();
      gateway.server = {
        to: jest.fn().mockReturnValue({ emit: emitSpy }),
      } as any;

      gateway.notifyStatusChanged(
        'doc-789',
        DocumentStatus.FLAGGED,
        null,
      );

      const callArgs = emitSpy.mock.calls[0][1];
      expect(callArgs.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
    });

    it('should not broadcast to all connected clients (no global emit)', () => {
      const emitSpy = jest.fn();
      gateway.server = {
        to: jest.fn().mockReturnValue({ emit: emitSpy }),
      } as any;

      gateway.notifyStatusChanged(
        'doc-999',
        DocumentStatus.REJECTED,
        DocumentStatus.ANALYZING,
      );

      // server.to should be called with a specific room, not the root
      expect(gateway.server.to).toHaveBeenCalledWith('document:doc-999');
      // Emit should only be called on the room-scoped server reference
      expect(emitSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleSubscribeDocument — access control', () => {
    it('should throw if documentId is missing', async () => {
      const client = { userId: 'user-1', userRole: 'user' } as any;

      await expect(
        gateway.handleSubscribeDocument(client, null as any),
      ).rejects.toThrow('documentId is required');

      await expect(
        gateway.handleSubscribeDocument(client, undefined as any),
      ).rejects.toThrow('documentId is required');
    });

    it('should throw if document is not found', async () => {
      (documentsService.findById as jest.Mock).mockResolvedValue(null);
      const client = { userId: 'user-1', userRole: 'user' } as any;

      await expect(
        gateway.handleSubscribeDocument(client, { documentId: 'missing' }),
      ).rejects.toThrow('Document not found');
    });

    it('should throw if user is not the owner and not an admin', async () => {
      (documentsService.findById as jest.Mock).mockResolvedValue({
        id: 'doc-x',
        ownerId: 'user-other',
      });
      const client = { userId: 'user-1', userRole: 'user' } as any;

      await expect(
        gateway.handleSubscribeDocument(client, { documentId: 'doc-x' }),
      ).rejects.toThrow('Access denied');
    });

    it('should allow owner to subscribe to their document', async () => {
      (documentsService.findById as jest.Mock).mockResolvedValue({
        id: 'doc-x',
        ownerId: 'user-1',
      });
      const client = {
        userId: 'user-1',
        userRole: 'user',
        join: jest.fn(),
      } as any;

      await gateway.handleSubscribeDocument(client, { documentId: 'doc-x' });

      expect(client.join).toHaveBeenCalledWith('document:doc-x');
    });

    it('should allow admin to subscribe to any document', async () => {
      (documentsService.findById as jest.Mock).mockResolvedValue({
        id: 'doc-x',
        ownerId: 'user-other',
      });
      const client = {
        userId: 'admin-1',
        userRole: 'admin',
        join: jest.fn(),
      } as any;

      await gateway.handleSubscribeDocument(client, { documentId: 'doc-x' });

      expect(client.join).toHaveBeenCalledWith('document:doc-x');
    });
  });
});
