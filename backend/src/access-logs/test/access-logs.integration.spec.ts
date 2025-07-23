import { Test, type TestingModule } from "@nestjs/testing"
import type { INestApplication } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import * as request from "supertest"
import { AccessLogsModule } from "../access-logs.module"
import { AccessLog } from "../entities/access-log.entity"

describe("AccessLogsModule (Integration)", () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "sqlite",
          database: ":memory:",
          entities: [AccessLog],
          synchronize: true,
        }),
        AccessLogsModule,
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it("should log API access and retrieve logs", async () => {
    // Make a request that should be logged
    await request(app.getHttpServer()).get("/access-logs").expect(200)

    // Wait a bit for the middleware to process
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Retrieve the logs
    const response = await request(app.getHttpServer()).get("/access-logs").expect(200)

    expect(response.body.data).toBeDefined()
    expect(response.body.total).toBeGreaterThan(0)
    expect(response.body.data[0]).toMatchObject({
      routePath: "/access-logs",
      httpMethod: "GET",
      ipAddress: expect.any(String),
      statusCode: 200,
    })
  })

  it("should filter logs by query parameters", async () => {
    const response = await request(app.getHttpServer()).get("/access-logs?httpMethod=GET&limit=5").expect(200)

    expect(response.body.data).toBeDefined()
    expect(response.body.limit).toBe(5)
    response.body.data.forEach((log: AccessLog) => {
      expect(log.httpMethod).toBe("GET")
    })
  })

  it("should return access log statistics", async () => {
    const response = await request(app.getHttpServer()).get("/access-logs/stats").expect(200)

    expect(response.body).toMatchObject({
      totalRequests: expect.any(Number),
      uniqueIPs: expect.any(Number),
      topRoutes: expect.any(Array),
    })
  })
})
