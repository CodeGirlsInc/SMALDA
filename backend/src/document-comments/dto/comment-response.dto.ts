export class CommentResponseDto {
  id: string
  documentId: string
  authorId: string
  authorName: string
  authorEmail: string
  content: string
  parentCommentId?: string
  isEdited: boolean
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
  replyCount?: number
  replies?: CommentResponseDto[]
}

export class PaginatedCommentsDto {
  data: CommentResponseDto[]
  total: number
  page: number
  limit: number
  totalPages: number
}
