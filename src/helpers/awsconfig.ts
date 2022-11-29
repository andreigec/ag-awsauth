//@ts-ignore
import { getCredentialsFilepath } from '@aws-sdk/shared-ini-file-loader/dist-cjs/getCredentialsFilepath';
import { loadSharedConfigFiles } from '@aws-sdk/shared-ini-file-loader';
import ini from 'ini';
import fs from 'fs';
import { IAwsCreds, IAwsCredsRaw } from '../types';
import { info } from 'ag-common/dist/common/helpers/log';

export const getAwsCredentials = async () => {
  const config = await loadSharedConfigFiles();
  const creds = config.credentialsFile;
  if (!creds.default) {
    creds.default = {};
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ret: Record<string, IAwsCredsRaw> = creds as any;

  return ret;
};

export const updateAwsCredentials = async (p: IAwsCreds) => {
  const creds = await getAwsCredentials();
  creds.default.region = p.region;
  creds.default.aws_access_key_id = p.accessKeyId;
  creds.default.aws_secret_access_key = p.secretAccessKey;
  creds.default.aws_session_token = p.sessionToken;
  creds.default.aws_access_token = p.accessToken;
  creds.default.aws_sso_authn = p.ssoAuthn;

  const newcreds = ini.stringify(creds);
  info(`saving updated default creds to .aws/credentials`);
  const credspath = getCredentialsFilepath();
  fs.writeFileSync(credspath, newcreds);
};
