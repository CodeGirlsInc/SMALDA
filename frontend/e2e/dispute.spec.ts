import { expect, test, type Page, type Route } from "@playwright/test";
import { API_PREFIX } from "../lib/api-contracts";
import type {
  DisputeListResponse,
  DisputeResponse,
} from "../lib/schemas/dispute";
import type { DocumentListResponse } from "../lib/schemas/document";

const API_BASE = "http://localhost:3001";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};
const ACCESS_TOKEN = "e2e-access-token";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const DESCRIPTION =
  "The parcel boundary conflicts with the registered survey.";

type DisputePayload = {
  documentId: string;
  description: string;
};

type FiledRequest = {
  payload: DisputePayload;
  authorization: string | null;
};

const emptyDisputes: DisputeListResponse = { data: [], total: 0 };
const documents: DocumentListResponse = {
  data: [
    {
      id: DOCUMENT_ID,
      title: "Land Deed",
      status: "pending",
      riskScore: null,
      riskFlags: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
};
const filedDispute: DisputeResponse = {
  id: "22222222-2222-4222-8222-222222222222",
  documentId: DOCUMENT_ID,
  description: DESCRIPTION,
  reason: {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Boundary mismatch",
  },
  status: "open",
  filedBy: USER_ID,
  createdAt: "2026-01-02T00:00:00.000Z",
};

async function authenticate(page: Page) {
  await page.addInitScript((token) => {
    window.localStorage.setItem("auth-token", token);
  }, ACCESS_TOKEN);
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockDisputeApi(page: Page) {
  let filedRequest: FiledRequest | null = null;

  await page.route(`${API_BASE}/api/**`, async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    if (
      request.method() === "GET" &&
      pathname === `${API_PREFIX}/disputes`
    ) {
      await fulfillJson(route, 200, emptyDisputes);
      return;
    }

    if (
      request.method() === "GET" &&
      pathname === `${API_PREFIX}/documents`
    ) {
      await fulfillJson(route, 200, documents);
      return;
    }

    if (
      request.method() === "GET" &&
      pathname === "/api/notifications"
    ) {
      await fulfillJson(route, 200, []);
      return;
    }

    if (
      request.method() === "GET" &&
      pathname === "/api/notifications/unread-count"
    ) {
      await fulfillJson(route, 200, { count: 0 });
      return;
    }

    if (
      request.method() === "POST" &&
      pathname === `${API_PREFIX}/disputes`
    ) {
      filedRequest = {
        payload: request.postDataJSON() as DisputePayload,
        authorization: request.headers()["authorization"] ?? null,
      };
      await fulfillJson(route, 201, filedDispute);
      return;
    }

    await fulfillJson(route, 404, { message: "Unmocked API request" });
  });

  return () => filedRequest;
}

test.describe("Dispute filing", () => {
  test("files a dispute through the FileDisputeModal", async ({ page }) => {
    await authenticate(page);
    const getFiledRequest = await mockDisputeApi(page);

    await page.goto("/en/disputes");
    await expect(
      page.getByRole("heading", { name: "My Disputes" })
    ).toBeVisible();

    await page.getByRole("button", { name: "File a new dispute" }).click();

    const modalHeading = page.getByRole("heading", {
      name: "File a New Dispute",
    });
    await expect(modalHeading).toBeVisible();
    await expect(
      page.getByRole("option", { name: "Land Deed" })
    ).toBeAttached();
    await page.getByLabel("Select Document").selectOption(DOCUMENT_ID);
    await page.getByLabel("Reason for Dispute").fill(DESCRIPTION);
    await page.getByRole("button", { name: "Submit Dispute" }).click();

    await expect.poll(() => getFiledRequest()).toMatchObject({
      payload: {
        documentId: DOCUMENT_ID,
        description: DESCRIPTION,
      },
      authorization: `Bearer ${ACCESS_TOKEN}`,
    });
    await expect(modalHeading).toBeHidden();
    await expect(page.getByText("Dispute Filed")).toBeVisible();
    await expect(page.getByText("Boundary mismatch")).toBeVisible();
    await expect(page.getByText(DESCRIPTION)).toBeVisible();
    const filedRow = page.getByRole("row").filter({ hasText: DESCRIPTION });
    await expect(filedRow.getByRole("cell").nth(2)).toHaveText("open");
  });
});
