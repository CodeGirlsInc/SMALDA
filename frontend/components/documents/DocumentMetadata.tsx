'use client';

interface DocumentMetadataProps {
  document: {
    id: string;
    fileHash: string;
    fileSize: number;
    mimeType: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function truncateHash(hash: string, chars = 12): string {
  if (hash.length <= chars * 2) return hash;
  return `${hash.slice(0, chars)}…${hash.slice(-chars)}`;
}

export function DocumentMetadata({ document }: DocumentMetadataProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Document Details</h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-gray-500">File Hash</dt>
          <dd className="mt-1 font-mono text-xs text-gray-900" title={document.fileHash}>
            {truncateHash(document.fileHash)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">File Size</dt>
          <dd className="mt-1 text-sm text-gray-900">{formatBytes(document.fileSize)}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">MIME Type</dt>
          <dd className="mt-1 text-sm text-gray-900">{document.mimeType}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Status</dt>
          <dd className="mt-1 text-sm font-medium text-gray-900">{document.status}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Created</dt>
          <dd className="mt-1 text-sm text-gray-900">{new Date(document.createdAt).toLocaleDateString()}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Updated</dt>
          <dd className="mt-1 text-sm text-gray-900">{new Date(document.updatedAt).toLocaleDateString()}</dd>
        </div>
      </dl>
    </div>
  );
}