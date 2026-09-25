type StringContract = {
  format?: 'email' | 'uuid';
  minLength?: number;
};

type ApiContracts = {
  api: {
    version: string;
  };
  register: {
    email: StringContract;
    password: { minLength: number };
    fullName: { minLength: number };
  };
  login: {
    email: StringContract;
    password: { minLength: number };
  };
  dispute: {
    documentId: StringContract;
    description: { minLength: number };
    statuses: string[];
  };
  documentUpload: {
    fileSize: { max: number };
    mimeTypes: string[];
  };
};

export const apiContracts = require('../contracts/api-contracts.json') as ApiContracts;

const contractFormats: Array<[string | undefined, string]> = [
  [apiContracts.register.email.format, 'email'],
  [apiContracts.login.email.format, 'email'],
  [apiContracts.dispute.documentId.format, 'uuid'],
];
for (const [format, expected] of contractFormats) {
  if (format !== expected) {
    throw new Error(`Unsupported API contract format: ${format}`);
  }
}

export const DISPUTE_STATUS_VALUES = apiContracts.dispute.statuses;

export const DOCUMENT_MAX_FILE_SIZE_BYTES =
  apiContracts.documentUpload.fileSize.max;
export const DOCUMENT_ALLOWED_MIME_TYPES =
  apiContracts.documentUpload.mimeTypes;
