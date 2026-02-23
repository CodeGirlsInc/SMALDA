import axios from 'axios';
import { Test } from '@nestjs/testing';

it('records successful delivery', async () => {
  (axios.post as jest.Mock).mockResolvedValue({ status: 200 });

  await service.dispatch('document.anchored', { id: '123' });

  const deliveries = await deliveryRepo.find();
  expect(deliveries[0].success).toBe(true);
});