describe("stellarTxUrl", () => {
  const originalNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK;

  afterEach(() => {
    if (originalNetwork === undefined) {
      delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    } else {
      process.env.NEXT_PUBLIC_STELLAR_NETWORK = originalNetwork;
    }
    jest.resetModules();
  });

  function buildUrl(network) {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = network;
    let url = "";
    jest.isolateModules(() => {
      const { stellarTxUrl } = require("./stellar");
      url = stellarTxUrl("abc123");
    });
    return url;
  }

  it("builds a testnet transaction URL", () => {
    expect(buildUrl("testnet")).toBe(
      "https://stellar.expert/explorer/testnet/tx/abc123",
    );
  });

  it("builds a public network transaction URL", () => {
    expect(buildUrl("public")).toBe(
      "https://stellar.expert/explorer/public/tx/abc123",
    );
  });
});