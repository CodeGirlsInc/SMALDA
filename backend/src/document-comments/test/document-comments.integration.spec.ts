import { Test, type TestingModule } from "@nestjs/testing"
import type { INestApplication } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import * as request from "supertest"
import { DocumentCommentsModule } from "../document-comments.module"
import { DocumentComment } from "../entities/document-comment.entity"
import type { CreateCommentDto } from "../dto/create-comment.dto"

describe("DocumentCommentsModule (Integration)", () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "sqlite",
          database: ":memory:",
          entities: [DocumentComment],
          synchronize: true,
        }),
        DocumentCommentsModule,
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  describe("Comment CRUD operations", () => {
    let createdCommentId: string
    const documentId = "550e8400-e29b-41d4-a716-446655440000"

    it("should create a comment", async () => {
      const createDto: CreateCommentDto = {
        documentId,
        authorId: "user-123",
        authorName: "John Doe",
        authorEmail: "john@example.com",
        content: "This is a test comment",
      }

      const response = await request(app.getHttpServer()).post("/document-comments").send(createDto).expect(201)

      expect(response.body).toMatchObject({
        documentId,
        authorId: "user-123",
        authorName: "John Doe",
        content: "This is a test comment",
        isEdited: false,
        isDeleted: false,
      })

      createdCommentId = response.body.id
    })

    it("should get comments for a document", async () => {
      const response = await request(app.getHttpServer()).get(`/document-comments/document/${documentId}`).expect(200)

      expect(response.body.data).toBeDefined()
      expect(response.body.total).toBeGreaterThan(0)
      expect(response.body.data[0]).toMatchObject({
        documentId,
        content: "This is a test comment",
      })
    })

    it("should get a specific comment", async () => {
      const response = await request(app.getHttpServer()).get(`/document-comments/${createdCommentId}`).expect(200)

      expect(response.body).toMatchObject({
        id: createdCommentId,
        documentId,
        content: "This is a test comment",
      })
    })

    it("should create a reply comment", async () => {
      const replyDto: CreateCommentDto = {
        documentId,
        authorId: "user-456",
        authorName: "Jane Doe",
        authorEmail: "jane@example.com",
        content: "This is a reply",
        parentCommentId: createdCommentId,
      }

      const response = await request(app.getHttpServer()).post("/document-comments").send(replyDto).expect(201)

      expect(response.body).toMatchObject({
        documentId,
        parentCommentId: createdCommentId,
        content: "This is a reply",
      })
    })

    it("should get document statistics", async () => {
      const response = await request(app.getHttpServer())
        .get(`/document-comments/document/${documentId}/stats`)
        .expect(200)

      expect(response.body).toMatchObject({
        totalComments: expect.any(Number),
        totalReplies: expect.any(Number),
        uniqueAuthors: expect.any(Number),
        recentActivity: expect.any(String),
      })
    })

    it("should get comments by author", async () => {
      const response = await request(app.getHttpServer()).get("/document-comments/author/user-123").expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0].authorId).toBe("user-123")
    })
  })

  describe("Comment filtering", () => {
    it("should filter comments by author", async () => {
      const documentId = "550e8400-e29b-41d4-a716-446655440001"

      // Create comments by different authors
      await request(app.getHttpServer()).post("/document-comments").send({
        documentId,
        authorId: "author-1",
        authorName: "Author One",
        authorEmail: "author1@example.com",
        content: "Comment by author 1",
      })

      await request(app.getHttpServer()).post("/document-comments").send({
        documentId,
        authorId: "author-2",
        authorName: "Author Two",
        authorEmail: "author2@example.com",
        content: "Comment by author 2",
      })

      // Filter by specific author
      const response = await request(app.getHttpServer())
        .get(`/document-comments/document/${documentId}?authorId=author-1`)
        .expect(200)

      expect(response.body.data).toBeDefined()
      response.body.data.forEach((comment: any) => {
        expect(comment.authorId).toBe("author-1")
      })
    })

    it("should paginate comments", async () => {
      const documentId = "550e8400-e29b-41d4-a716-446655440002"

      // Create multiple comments
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post("/document-comments")
          .send({
            documentId,
            authorId: `user-${i}`,
            authorName: `User ${i}`,
            authorEmail: `user${i}@example.com`,
            content: `Comment ${i}`,
          })
      }

      // Test pagination
      const response = await request(app.getHttpServer())
        .get(`/document-comments/document/${documentId}?page=1&limit=3`)
        .expect(200)

      expect(response.body.data.length).toBeLessThanOrEqual(3)
      expect(response.body.page).toBe(1)
      expect(response.body.limit).toBe(3)
      expect(response.body.totalPages).toBeGreaterThan(0)
    })
  })
})
