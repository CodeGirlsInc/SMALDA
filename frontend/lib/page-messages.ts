// Translatable strings for the pages listed in #1519 (en/fr/es parity).
// Pages should read these through next-intl (useTranslations) instead of hard-coded English.
export const pageMessages = {
  en: {
    uploadTitle: 'Upload New Document',
    documentTitle: 'Document Title',
    verifyOnStellar: 'Verify on Stellar',
    downloadReport: 'Download Report',
    documentVerification: 'Document verification',
    genericError: 'Something went wrong. Please try again.',
  },
  fr: {
    uploadTitle: 'Téléverser un nouveau document',
    documentTitle: 'Titre du document',
    verifyOnStellar: 'Vérifier sur Stellar',
    downloadReport: 'Télécharger le rapport',
    documentVerification: 'Vérification du document',
    genericError: "Une erreur s'est produite. Veuillez réessayer.",
  },
  es: {
    uploadTitle: 'Subir nuevo documento',
    documentTitle: 'Título del documento',
    verifyOnStellar: 'Verificar en Stellar',
    downloadReport: 'Descargar informe',
    documentVerification: 'Verificación del documento',
    genericError: 'Algo salió mal. Inténtalo de nuevo.',
  },
} as const;

export type PageMessageKey = keyof (typeof pageMessages)['en'];
