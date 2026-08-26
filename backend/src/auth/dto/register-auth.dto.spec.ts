import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterAuthDto } from './register-auth.dto';

describe('RegisterAuthDto', () => {
  it('should trim and lowercase email', async () => {
    const dto = plainToInstance(RegisterAuthDto, {
      email: '  Test@EXAMPLE.COM  ',
      password: 'password123',
      fullName: '  John Doe  ',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.email).toBe('test@example.com');
    expect(dto.fullName).toBe('John Doe');
  });

  it('should reject invalid email', async () => {
    const dto = plainToInstance(RegisterAuthDto, {
      email: 'not-an-email',
      password: 'password123',
      fullName: 'John Doe',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const emailErrors = errors.filter((e) => e.property === 'email');
    expect(emailErrors.length).toBeGreaterThan(0);
  });

  it('should reject short password', async () => {
    const dto = plainToInstance(RegisterAuthDto, {
      email: 'test@example.com',
      password: '12345',
      fullName: 'John Doe',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const passwordErrors = errors.filter((e) => e.property === 'password');
    expect(passwordErrors.length).toBeGreaterThan(0);
  });
});
