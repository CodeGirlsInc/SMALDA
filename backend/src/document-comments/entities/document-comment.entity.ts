import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm"

@Entity("document_comments")
@Index(["documentId", "createdAt"])
@Index(["authorId"])
@Index(["parentCommentId"])
export class DocumentComment {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ name: "document_id" })
  @Index()
  documentId: string

  @Column({ name: "author_id" })
  authorId: string

  @Column({ name: "author_name", length: 255 })
  authorName: string

  @Column({ name: "author_email", length: 255 })
  authorEmail: string

  @Column({ type: "text" })
  content: string

  @Column({ name: "parent_comment_id", nullable: true })
  parentCommentId?: string

  @ManyToOne(
    () => DocumentComment,
    (comment) => comment.replies,
    { nullable: true },
  )
  @JoinColumn({ name: "parent_comment_id" })
  parentComment?: DocumentComment

  @OneToMany(
    () => DocumentComment,
    (comment) => comment.parentComment,
  )
  replies: DocumentComment[]

  @Column({ name: "is_edited", default: false })
  isEdited: boolean

  @Column({ name: "is_deleted", default: false })
  isDeleted: boolean

  @Column({ name: "deleted_at", nullable: true })
  deletedAt?: Date

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date

  // Virtual field for reply count
  replyCount?: number
}
