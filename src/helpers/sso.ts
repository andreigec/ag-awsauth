import {
  ListAccountsCommand,
  ListAccountRolesCommand,
  GetRoleCredentialsCommand,
  SSOClient,
} from '@aws-sdk/client-sso';
import { info } from 'ag-common/dist/common/helpers/log';
import { identityCenterRegion } from '../config';
import { IAwsCreds } from '../types';
import { getAwsCredentials } from './awsconfig';
import { validateCredentials } from './sts';

export const tryExistingCredentials = async (): Promise<
  IAwsCreds | undefined
> => {
  const credraw = await getAwsCredentials();
  if (!credraw.default.aws_access_token) {
    return undefined;
  }

  const credentials: IAwsCreds = {
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

  info(`test cached credentials NOT valid`);
  return undefined;
};

export const getOIDCCredentialsFromAccessToken = async (p: {
  accessToken: string;
  ssoAuthn: string;
}): Promise<IAwsCreds> => {
  const sso = new SSOClient({ region: identityCenterRegion });
  const accounts = await sso.send(
    new ListAccountsCommand({ accessToken: p.accessToken }),
  );

  const accountId = accounts.accountList?.[0]?.accountId;
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
