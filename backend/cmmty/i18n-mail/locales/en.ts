export const enTranslations = {
  welcome: {
    subject: 'Welcome to Smalda',
    greeting: (name: string) => `Hi ${name},`,
    body: 'Thank you for joining Smalda. We are excited to help you secure your land documents.',
  },
  verificationComplete: {
    subject: 'Document Verification Complete',
    body: (documentTitle: string, txHash: string) => `
      <p>Your document <strong>${documentTitle}</strong> has been anchored on the Stellar network.</p>
      <p>Transaction hash: <code>${txHash}</code></p>
      <p>You can view the transaction via the Stellar Horizon explorer.</p>
    `,
  },
  riskAlert: {
    subject: 'Risk Alert: Document Needs Attention',
    body: (documentTitle: string, flags: string[]) => {
      const flagList = flags.map((flag) => `<li>${flag}</li>`).join('');
      return `
        <p>The document <strong>${documentTitle}</strong> triggered the following risk flags:</p>
        <ul>${flagList}</ul>
        <p>Please review the document and supply any missing information.</p>
      `;
    },
  },
};
