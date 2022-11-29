import {
  SSOOIDCClient,
  RegisterClientCommand,
  StartDeviceAuthorizationCommand,
  CreateTokenCommand,
} from '@aws-sdk/client-sso-oidc';
import { warn } from 'ag-common/dist/common/helpers/log';
import { sleep } from 'ag-common/dist/common/helpers/sleep';
import { fromBase64 } from 'ag-common/dist/common/helpers/string';
import fetch from 'node-fetch';
import { identityCenterRegion } from '../config';
import {
  IAppInstance,
  IAppInstanceDetails,
  IAppInstances,
  IAwsCreds,
  ISamlAssertion,
} from '../types';
import { closeBrowser, goToPage } from './browser';

export async function appInstances(p: { ssoAuthn: string }) {
  const ai = (await (
    await fetch(
      `https://portal.sso.${identityCenterRegion}.amazonaws.com/instance/appinstances`,
      { headers: { 'x-amz-sso_bearer_token': p.ssoAuthn } },
    )
  ).json()) as IAppInstances;

  if (!ai?.result) {
    throw new Error('appinstance error' + JSON.stringify(ai, null, 2));
  }

  return ai.result;
}

export async function getSamlAssertion(
  p: IAwsCreds,
  instance: IAppInstance,
): Promise<{ samlAssertion: string; providerArn: string; roleArn: string }> {
  //get saml assertion path

  const det = (await (
    await fetch(
      `https://portal.sso.${identityCenterRegion}.amazonaws.com/instance/appinstance/${instance.id}/profiles`,
      { headers: { 'x-amz-sso_bearer_token': p.ssoAuthn } },
    )
  ).json()) as IAppInstanceDetails;

  const asserturl = det?.result?.[0]?.url;
  if (!asserturl) {
    throw new Error('assertion url cant be found');
  }

  const assertion = (await (
    await fetch(asserturl, {
      headers: { 'x-amz-sso_bearer_token': p.ssoAuthn },
    })
  ).json()) as ISamlAssertion;

  //get accid
  //<saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xsd:string">arn:aws:iam::595367634560:saml-provider/aws,arn:aws:iam::595367634560:role/awsSaml</saml2:AttributeValue>
  const decoded = fromBase64(assertion.encodedResponse);
  const res = new RegExp(
    /<saml2:AttributeValue xmlns:xsi="http:\/\/www.w3.org\/2001\/XMLSchema-instance" xsi:type="xsd:string">(arn.*?)</gim,
  ).exec(decoded);

  if (!res?.[1]) {
    throw new Error('bad saml');
  }

  const [providerArn, roleArn] = res[1].split(',');

  return { samlAssertion: assertion.encodedResponse, providerArn, roleArn };
}

export async function getAccessToken(p: {
  identityCenterRegion: string;
  ssoStartUrl: string;
}): Promise<{ accessToken: string; ssoAuthn: string }> {
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

  if (!sda.verificationUriComplete) {
    throw new Error('no verif url');
  }

  //go to browser site for auth
  const page = await goToPage(sda.verificationUriComplete);
  let accessToken: string | undefined;
  let ssoAuthn: string | undefined;
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
      const cookies = await page?.cookies();
      ssoAuthn = cookies?.find((c) => c.name === 'x-amz-sso_authn')?.value;
      if (!accessToken) {
        throw new Error('no access token');
      }

      if (!ssoAuthn) {
        throw new Error('no aws authn');
      }

      try {
        await page?.close();
        await closeBrowser();
      } catch (e) {
        //
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
  return { accessToken, ssoAuthn: ssoAuthn as string };
}
