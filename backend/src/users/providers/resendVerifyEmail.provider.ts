import { Injectable } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { EmailService } from 'src/email/email.service';
import { EmailVerificationTokenProvider } from './emailVerificationToken.provider';

@Injectable()
export class ResendEmailVerificationProvider {
  constructor(
    private readonly emailService: EmailService,

    private readonly emailVerificationToken: EmailVerificationTokenProvider,
  ) {}

  public async resendEmailVerification(user: User) {
    // check if the email has already been verified
    if (user.isEmailVerified) {
      return {
        message: 'User has already been verified',
      };
    }

    // generate the token
    const verificationToken =
      await this.emailVerificationToken.getEmailVerificationToken(user);

    // send the verification email
    return await this.emailService.sendVerificationEmail(
      user,
      verificationToken,
    );
  }
}
