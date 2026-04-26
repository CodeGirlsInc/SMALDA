import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import { Webhook } from './webhook.entity';
import { WebhooksService } from './webhooks.service';

jest.mock('axios');

describe('WebhooksService', () => {
  let service: WebhooksService;
  let repository: Repository<Webhook>;

  const mockWebhook = {
    id: 'webhook-id',
    url: 'https://example.com/hook',
    events: ['document.uploaded'],
    secret: 'test-secret',
    isActive: true,
    userId: 'user-id',
  } as Webhook;

  const mockRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: getRepositoryToken(Webhook),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    repository = module.get<Repository<Webhook>>(getRepositoryToken(Webhook));
  });

  it('should sign payload with HMAC SHA256', () => {
    const signature = service.signPayload({ hello: 'world' }, 'secret');
    expect(signature).toHaveLength(64);
    expect(signature).toBe(service.signPayload({ hello: 'world' }, 'secret'));
  });

  it('should deliver payload and retry until success', async () => {
    mockRepository.find.mockResolvedValue([mockWebhook]);
    (axios.post as jest.Mock)
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ status: 200 });

    await service.deliverEvent('document.uploaded', { id: 'doc-1' });

    expect(axios.post).toHaveBeenCalledTimes(3);
  });

  it('should stop after 3 failed attempts', async () => {
    mockRepository.find.mockResolvedValue([mockWebhook]);
    (axios.post as jest.Mock).mockRejectedValue(new Error('network error'));

    await service.deliverEvent('document.uploaded', { id: 'doc-1' });

    expect(axios.post).toHaveBeenCalledTimes(3);
  });
});
