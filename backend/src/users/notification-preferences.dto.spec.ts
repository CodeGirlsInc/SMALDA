import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateNotificationPreferencesDto } from './dto/notification-preferences.dto';

const check = (plain: object) =>
  validate(plainToInstance(UpdateNotificationPreferencesDto, plain), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('UpdateNotificationPreferencesDto', () => {
  it('accepts known types with boolean channels', async () => {
    expect(
      await check({ risk_alert: { email: false, inApp: true } }),
    ).toHaveLength(0);
  });

  it('rejects unknown preference keys', async () => {
    const errors = await check({ marketing: { email: true } });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects unknown channels and non-boolean values', async () => {
    expect((await check({ risk_alert: { sms: true } })).length).toBeGreaterThan(0);
    expect((await check({ risk_alert: { email: 'yes' } })).length).toBeGreaterThan(0);
  });
});
