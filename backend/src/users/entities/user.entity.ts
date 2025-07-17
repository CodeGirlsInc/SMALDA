import { Exclude } from 'class-transformer';
import { RefreshTokenEntity } from 'src/auth/entities/refreshToken.entity';
import { UserRole } from 'src/auth/enums/roles.enum';
import { CloudinaryImage } from 'src/cloudinary/cloudinary.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    nullable: false,
  })
  firstName: string;

  @Column({
    nullable: true,
  })
  lastName?: string;

  @Column({
    nullable: true,
  })
  userName?: string;

  @Column({
    nullable: false,
    unique: true,
  })
  email: string;

  @Column({
    nullable: false,
  })
  @Exclude()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @OneToOne(() => CloudinaryImage, (profilePic) => profilePic.user)
  profilePic?: CloudinaryImage;

  @OneToMany(() => RefreshTokenEntity, (token) => token.user)
  @Exclude()
  refreshToken: RefreshTokenEntity[];

  @Column({
    default: false,
  })
  isEmailVerified: boolean;

  @Column({
    nullable: true,
  })
  @Exclude()
  emailVerificationToken?: string;

  @Column({
    nullable: true,
  })
  @Exclude()
  emailVerificationExpiresIn?: Date;

  @Column({
    nullable: true,
  })
  @Exclude()
  passwordResetToken?: string;

  @Column({
    nullable: true,
  })
  @Exclude()
  passwordResetExpiresIn?: Date;

  @Column({
    type: 'boolean',
    default: true,
  })
  isActive: boolean;

  @Column({
    type: 'boolean',
    default: false,
  })
  isDeleted: boolean;

  @Column({
    type: 'boolean',
    default: false,
  })
  isSuspended: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
