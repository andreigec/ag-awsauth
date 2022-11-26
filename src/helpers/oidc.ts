import {
  SSOOIDCClient,
  RegisterClientCommand,
  StartDeviceAuthorizationCommand,
  CreateTokenCommand,
} from '@aws-sdk/client-sso-oidc';
import { warn } from 'ag-common/dist/common/helpers/log';
import { sleep } from 'ag-common/dist/common/helpers/sleep';
import cp from 'child_process';

export async function getAccessToken(p: {
  identityCenterRegion: string;
  ssoStartUrl: string;
}) {
  const sso_oidc = new SSOOIDCClient({ region: p.identityCenterRegion });
  const rcc = await sso_oidc.send(
    new RegisterClientCommand({ clientName: 'andrei', clientType: 'public' }),
  );

  const sda = await sso_oidc.send(
    new StartDeviceAuthorizationCommand({
      clientId: rcc.clientId,
      clientSecret: rcc.clientSecret,
      startUrl: p.ssoStartUrl,
    }),
  );

  //go to browser site for auth
  cp.exec(`start ${sda.verificationUriComplete}`);
  let accessToken: string | undefined;
  //keep trying to receive auth until user clicks, or timeout
  let trycount = 0;
  do {
    if (trycount > 10) {
      throw new Error('too many fails');
    }

    trycount += 1;

    try {
      const ctc = await sso_oidc.send(
        new CreateTokenCommand({
          clientId: rcc.clientId,
          clientSecret: rcc.clientSecret,
          code: sda.userCode,
          deviceCode: sda.deviceCode,
          grantType: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      );

      accessToken = ctc.accessToken;
      if (!accessToken) {
        throw new Error('no access token');
      }
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const es = (e as any).toString();
      if (!es.includes('AuthorizationPendingException')) {
        throw e;
      }

      warn('waiting for device approval...');
      await sleep(5000);
    }
  } while (!accessToken);
  return accessToken;
}
