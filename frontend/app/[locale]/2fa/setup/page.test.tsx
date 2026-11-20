import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import TwoFactorSetupPage from "@/app/[locale]/2fa/setup/page";

const mockRequest = jest.fn();
const mockPush = jest.fn();

jest.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/lib/api-client", () => ({
  API_V1_BASE: "http://localhost:3001/api/v1",
  ApiError: class ApiError extends Error {
    status: number | null;
    messageKey: string;
    backendMessage?: string;

    constructor(opts: {
      status: number | null;
      messageKey: string;
      backendMessage?: string;
    }) {
      super(opts.messageKey);
      this.status = opts.status;
      this.messageKey = opts.messageKey;
      this.backendMessage = opts.backendMessage;
    }
  },
  request: (...args: unknown[]) => mockRequest(...args),
}));

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TwoFactorSetupPage />
    </NextIntlClientProvider>,
  );
}

describe("TwoFactorSetupPage", () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockPush.mockClear();
  });

  it("confirms with the code only and shows the returned backup codes", async () => {
    mockRequest
      .mockResolvedValueOnce({
        secret: "REALBASE32SECRET",
        otpauthUrl: "otpauth://totp/SMALDA?secret=REALBASE32SECRET",
      })
      .mockResolvedValueOnce({ enabled: true, backupCodes: ["CODE-ABCDEF"] });
    renderPage();

    const codeInput = await screen.findByLabelText("6-digit code from your app");
    fireEvent.change(codeInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm and enable 2FA" }));

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(2));
    expect(mockRequest).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3001/api/v1/auth/2fa/verify",
      { method: "POST", body: { code: "123456" } },
    );
    expect(await screen.findByText("CODE-ABCDEF")).toBeInTheDocument();
    expect(screen.queryByText("JBSWY3DPEHPK3PXP")).not.toBeInTheDocument();
  });

  it("shows an error instead of a fallback secret when setup omits the secret", async () => {
    mockRequest.mockResolvedValueOnce({
      otpauthUrl: "otpauth://totp/SMALDA?secret=REALBASE32SECRET",
    });
    renderPage();

    expect(
      await screen.findByText(
        "We couldn't get a setup secret from the server. Please try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("JBSWY3DPEHPK3PXP")).not.toBeInTheDocument();
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
});
