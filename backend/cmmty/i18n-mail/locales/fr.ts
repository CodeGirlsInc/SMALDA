export const frTranslations = {
  welcome: {
    subject: 'Bienvenue sur Smalda',
    greeting: (name: string) => `Bonjour ${name},`,
    body: 'Merci de rejoindre Smalda. Nous sommes ravis de vous aider à sécuriser vos documents fonciers.',
  },
  verificationComplete: {
    subject: 'Vérification du document terminée',
    body: (documentTitle: string, txHash: string) => `
      <p>Votre document <strong>${documentTitle}</strong> a été ancré sur le réseau Stellar.</p>
      <p>Hash de la transaction : <code>${txHash}</code></p>
      <p>Vous pouvez consulter la transaction via l'explorateur Stellar Horizon.</p>
    `,
  },
  riskAlert: {
    subject: 'Alerte de risque : Document nécessitant une attention',
    body: (documentTitle: string, flags: string[]) => {
      const flagList = flags.map((flag) => `<li>${flag}</li>`).join('');
      return `
        <p>Le document <strong>${documentTitle}</strong> a déclenché les alertes de risque suivantes :</p>
        <ul>${flagList}</ul>
        <p>Veuillez vérifier le document et fournir les informations manquantes.</p>
      `;
    },
  },
};
