import {
  ListAccountsCommand,
  ListAccountRolesCommand,
  GetRoleCredentialsCommand,
  SSOClient,
} from '@aws-sdk/client-sso';
import { info } from 'ag-common/dist/common/helpers/log';
import { IAwsCreds } from '../types';
import { getAwsCredentials } from './awsconfig';
import { validateCredentials } from './sts';

export const tryExistingCredentials = async ({
  region,
}: {
  region: string;
}): Promise<{ credentials: IAwsCreds; accountId: string } | undefined> => {
  const credraw = await getAwsCredentials();
  if (
    !credraw.default.aws_access_key_id ||
    !credraw.default.aws_secret_access_key ||
    !credraw.default.aws_session_token ||
    !credraw.default.aws_access_token
  ) {
    return undefined;
  }

  const credentials: IAwsCreds = {
    accessKeyId: credraw.default.aws_access_key_id,
    secretAccessKey: credraw.default.aws_secret_access_key,
    sessionToken: credraw.default.aws_session_token,
    accessToken: credraw.default.aws_access_token,
    region,
  };

  const v = await validateCredentials(credentials);
  if (v) {
    return { credentials, accountId: v.accountId };
  }

  info(`test cached credentials NOT valid`);
  return undefined;
};

export const getCredentialsFromAccessToken = async (p: {
  region: string;
  accessToken: string;
}): Promise<{ credentials: IAwsCreds; accountId: string }> => {
  const sso = new SSOClient({ region: p.region });
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
  info('role=', role);
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
    credentials: {
      accessKeyId: rc.accessKeyId,
      region: p.region,
      secretAccessKey: rc.secretAccessKey,
      sessionToken: rc.sessionToken,
      accessToken: p.accessToken,
    },
    accountId,
  };
};
