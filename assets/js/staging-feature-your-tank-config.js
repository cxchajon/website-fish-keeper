/*
 * Staging-only public configuration.
 *
 * This file exists only on codex/staging-signed-upload-site. It deliberately
 * includes no credentials. Do not merge it into the production deployment.
 */
window.TTG_FEATURE_TANK_CONFIG = Object.freeze({
  signedUploadsEnabled: true,
  uploadAuthorizerEndpoint: 'https://ttg-upload-authorizer-staging.fishkeepinglifeco.workers.dev',
  submissionsEnabled: false,
  formspreeEndpoint: '',
  confirmationEndpoint: ''
});
