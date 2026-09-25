import {
  LAST_VIEWED_PARCEL_KEY,
  clearLastViewedParcel,
  readLastViewedParcelId,
  saveLastViewedParcelId,
} from "@/lib/map-state";

let storage: {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
  key: jest.Mock;
  length: number;
};

beforeEach(() => {
  storage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    key: jest.fn(),
    length: 0,
  };
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: storage,
  });
});

describe("map session state", () => {
  it("uses a user-scoped sessionStorage key", () => {
    storage.getItem.mockReturnValue("doc-1");

    expect(readLastViewedParcelId("user-1")).toBe("doc-1");
    saveLastViewedParcelId("doc-2", "user-1");

    expect(storage.getItem).toHaveBeenCalledWith(
      `${LAST_VIEWED_PARCEL_KEY}:user-1`,
    );
    expect(storage.setItem).toHaveBeenCalledWith(
      `${LAST_VIEWED_PARCEL_KEY}:user-1`,
      "doc-2",
    );
  });

  it("clears a specific user and all users on logout", () => {
    clearLastViewedParcel("user-1");
    expect(storage.removeItem).toHaveBeenCalledWith(
      `${LAST_VIEWED_PARCEL_KEY}:user-1`,
    );

    storage.removeItem.mockClear();
    storage.key.mockReturnValue(`${LAST_VIEWED_PARCEL_KEY}:user-1`);
    Object.defineProperty(storage, "length", { configurable: true, value: 1 });
    clearLastViewedParcel();
    expect(storage.removeItem).toHaveBeenCalledWith(LAST_VIEWED_PARCEL_KEY);
    expect(storage.removeItem).toHaveBeenCalledWith(
      `${LAST_VIEWED_PARCEL_KEY}:user-1`,
    );
  });

  it("fails closed when session storage is unavailable", () => {
    storage.getItem.mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    storage.setItem.mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(readLastViewedParcelId("user-1")).toBeNull();
    expect(() => saveLastViewedParcelId("doc-1", "user-1")).not.toThrow();
  });
});
