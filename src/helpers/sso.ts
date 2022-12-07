import {
  ListAccountsCommand,
  ListAccountRolesCommand,
  GetRoleCredentialsCommand,
  SSOClient,
} from '@aws-sdk/client-sso';
import { fromBase64 } from 'ag-common/dist/common/helpers/string';
import { info } from 'ag-common/dist/common/helpers/log';
import { identityCenterRegion } from '../config';
import {
  IAppInstance,
  IAppInstanceDetails,
  IAppInstances,
  IAwsCreds,
  ISamlAssertion,
} from '../types';
import { getAwsCredentials } from './awsconfig';
import { validateCredentials } from './sts';
import fetch from 'node-fetch';

export const getAssumedRole = async (p: {
  accessToken: string;
  accountId?: string;
}): Promise<{ accountId: string; roleName: string }> => {
  const sso = new SSOClient({ region: identityCenterRegion });
  let accountId = p.accountId;
  if (!accountId) {
    const accounts = await sso.send(
      new ListAccountsCommand({ accessToken: p.accessToken }),
    );

    accountId = accounts.accountList?.[0]?.accountId;
  }

  if (!accountId) {
    throw new Error('no account id');
  }

  const rolesResult = await sso.send(
    new ListAccountRolesCommand({
      accessToken: p.accessToken,
      accountId,
    }),
  );

  const roles =
    rolesResult.roleList
      ?.map((r) => ({
        accountId: r.accountId || '',
        roleName: r.roleName || '',
      }))
      ?.filter((r) => r.accountId && r.roleName) || [];

  if (roles.length === 0) {
    throw new Error('no roles can be assumed');
  }

  if (roles.length > 1) {
    throw new Error('too many roles' + JSON.stringify(roles, null, 2));
  }

  const role = roles[0];

  return role;
};

export const getOIDCCredentialsFromAccessToken = async (p: {
  accessToken: string;
  ssoAuthn: string;
}): Promise<IAwsCreds> => {
  const sso = new SSOClient({ region: identityCenterRegion });
  const role = await getAssumedRole({ accessToken: p.accessToken });
  const ssoResp = await sso.send(
    new GetRoleCredentialsCommand({
      ...role,
      accessToken: p.accessToken,
    }),
  );

  const rc = ssoResp.roleCredentials;
  if (
    !rc?.accessKeyId ||
    !rc?.expiration ||
    !rc?.secretAccessKey ||
    !rc?.sessionToken
  ) {
    throw new Error('role creds undefined:' + JSON.stringify(rc, null, 2));
  }

  return {
    ...p,
    accessKeyId: rc.accessKeyId,
    secretAccessKey: rc.secretAccessKey,
    sessionToken: rc.sessionToken,
    region: identityCenterRegion,
  };
};

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

export const tryExistingCredentials = async (): Promise<
  IAwsCreds | undefined
> => {
  const credraw = await getAwsCredentials();
  if (!credraw.default.aws_access_token) {
    return undefined;
  }

  let credentials: IAwsCreds = {
    accessKeyId: credraw.default.aws_access_key_id,
    secretAccessKey: credraw.default.aws_secret_access_key,
    sessionToken: credraw.default.aws_session_token,
    accessToken: credraw.default.aws_access_token,
    ssoAuthn: credraw.default.aws_sso_authn,
    region: identityCenterRegion,
  };

  const v = await validateCredentials(credentials);
  if (v) {
    return credentials;
  }

  if (credraw.default.aws_access_token && credraw.default.aws_sso_authn) {
    try {
      info('trying oidc refresh');
      credentials = await getOIDCCredentialsFromAccessToken({
        accessToken: credraw.default.aws_access_token,
        ssoAuthn: credraw.default.aws_sso_authn,
      });
      return credentials;
    } catch (e) {
      //
      info('access token or sso expired, need to wipe', e);
    }
  }

  return {
    accessToken: '',
    ssoAuthn: '',
    region: identityCenterRegion,
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
  };
};
