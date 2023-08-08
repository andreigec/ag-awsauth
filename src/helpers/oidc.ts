import {
  CreateTokenCommand,
  RegisterClientCommand,
  SSOOIDCClient,
  StartDeviceAuthorizationCommand,
} from '@aws-sdk/client-sso-oidc';
import { warn } from 'ag-common/dist/common/helpers/log';
import { sleep } from 'ag-common/dist/common/helpers/sleep';

import { identityCenterRegion } from '../config';
import type { IAwsCreds } from '../types';
import { getMFA } from './browser';
import { enterCreds } from './input';
import { validateVersion } from './version';

export async function requestMFA(p: {
  identityCenterRegion: string;
  ssoStartUrl: string;
}): Promise<IAwsCreds> {
  const sso_oidc = new SSOOIDCClient({ region: p.identityCenterRegion });
  await validateVersion();
  warn('starting MFA flow');
  const creds = enterCreds();
  const rcc = await sso_oidc.send(
    new RegisterClientCommand({
      clientName: creds.username,
      clientType: 'public',
    }),
  );

  const sda = await sso_oidc.send(
    new StartDeviceAuthorizationCommand({
      clientId: rcc.clientId,
      clientSecret: rcc.clientSecret,
      startUrl: p.ssoStartUrl,
    }),
  );

  if (!sda.verificationUriComplete) {
    throw new Error('no verif url');
  }

  const { ssoAuthn } = await getMFA({
    verificationUriComplete: sda.verificationUriComplete,
    creds,
  });

  let accessToken: string | undefined;
  //keep trying to receive auth until user clicks, or timeout
  let trycount = 0;
  do {
    if (trycount > 3) {
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

  return {
    accessToken,
    ssoAuthn,
    region: identityCenterRegion,
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
  };
}
