import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from "typeorm"
import { Review } from "./review.entity"
import { User } from '../../users/entities/user.entity';
import { CommentType } from "../enums/review.enums"

@Entity("review_comments")
export class ReviewComment {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ name: "review_id", type: "uuid" })
  reviewId: string

  @Column({ name: "author_id", type: "uuid" })
  authorId: string

  @Column({ type: "text" })
  content: string

  @Column({
    type: "enum",
    enum: CommentType,
    default: CommentType.GENERAL,
  })
  type: CommentType

  @Column({
    name: "is_internal",
    type: "boolean",
    default: false,
  })
  isInternal: boolean

  @Column({
    name: "metadata",
    type: "jsonb",
    default: {},
  })
  metadata: Record<string, any>

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date

  // Relations
  @ManyToOne(
    () => Review,
    (review) => review.comments,
    {
      onDelete: "CASCADE",
    },
  )
  @JoinColumn({ name: "review_id" })
  review: Review

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "author_id" })
  author: User
}
