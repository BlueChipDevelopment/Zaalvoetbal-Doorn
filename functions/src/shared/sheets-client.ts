import * as logger from "firebase-functions/logger";

/**
 * Helper: Authorize Google Sheets API
 */
export async function getSheetsClient() {
  const { google } = await import("googleapis");
  const authOptions: any = {
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  };

  // Alleen lokaal een keyfile gebruiken
  if (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development') {
    authOptions.keyFile = "assets/service-account-key.json";
  }

  const auth = new google.auth.GoogleAuth(authOptions);
  const authClient = await auth.getClient();
  const projectId = await auth.getProjectId();
  let clientEmail = undefined;

  // Probeer eerst direct uit authClient
  if (authClient && typeof authClient === 'object' && 'email' in authClient) {
    clientEmail = (authClient as any).email;
  }

  // Als niet aanwezig: probeer metadata server (productie)
  if (!clientEmail) {
    try {
      const res = await (await import('node-fetch')).default(
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email',
        { headers: { 'Metadata-Flavor': 'Google' } }
      );
      if (res.ok) {
        clientEmail = await res.text();
      }
    } catch (e) {
      // negeer, log alleen als het lukt
    }
  }

  logger.info(`Google Sheets authenticatie: projectId=${projectId}, clientEmail=${clientEmail}`);
  return google.sheets({ version: "v4", auth: authClient as any });
}