import axios from "axios";
import { get, post } from "./index";

jest.mock("axios", () => {
  const mockAxios = {
    create: jest.fn(() => mockAxios),
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    defaults: { headers: { common: {} } },
  };
  return mockAxios;
});

const mockAxios = axios as any;

describe("apiClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Mock window.location.href
    delete (window as any).location;
    (window as any).location = { href: "" };
  });

  it("attaches Authorization header if token exists", () => {
    localStorage.setItem("smalda_access_token", "test-token");
    
    // Get the request interceptor function
    const interceptor = mockAxios.interceptors.request.use.mock.calls[0][0];
    const config = { headers: {} } as any;
    
    const result = interceptor(config);
    expect(result.headers.Authorization).toBe("Bearer test-token");
  });

  it("redirects to /login and clears storage on 401", async () => {
    localStorage.setItem("smalda_access_token", "expired-token");
    
    // Get the response interceptor error handler
    const errorHandler = mockAxios.interceptors.response.use.mock.calls[0][1];
    
    const error = {
      response: {
        status: 401,
        data: { message: "Unauthorized" }
      }
    };

    try {
      await errorHandler(error);
    } catch (err: any) {
      expect(err.statusCode).toBe(401);
      expect(localStorage.getItem("smalda_access_token")).toBeNull();
      expect(window.location.href).toBe("/login");
    }
  });

  it("normalizes error shape", async () => {
    const errorHandler = mockAxios.interceptors.response.use.mock.calls[0][1];
    
    const error = {
      response: {
        status: 500,
        data: { error: "Internal Server Error" }
      }
    };

    try {
      await errorHandler(error);
    } catch (err: any) {
      expect(err).toEqual({
        message: "Internal Server Error",
        statusCode: 500
      });
    }
  });

  it("typed helpers call axios correctly", async () => {
    mockAxios.get.mockResolvedValue({ data: { id: 1, name: "Test" } });
    
    const result = await get("/test");
    
    expect(mockAxios.get).toHaveBeenCalledWith("/test", {});
    expect(result).toEqual({ id: 1, name: "Test" });
  });
});
