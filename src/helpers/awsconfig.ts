import { loadSharedConfigFiles } from '@aws-sdk/shared-ini-file-loader';
import { info } from 'ag-common/dist/common/helpers/log';
import fs from 'fs';
import { stringify } from 'ini';

import type { IAwsCreds, IAwsCredsRaw } from '../types';
import { getCredentialsFilepath } from './getCredentialsFilepath';

export const getAwsCredentials = async () => {
  const config = await loadSharedConfigFiles();
  const creds = config.credentialsFile;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!creds.default) {
    creds.default = {};
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ret: Record<string, IAwsCredsRaw> = creds as any;

  return ret;
};

export const updateAwsCredentials = async (p: IAwsCreds | undefined) => {
  const creds = await getAwsCredentials();
  if (!p) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    creds.default = {} as any;
  } else {
    creds.default.region = p.region;
    creds.default.aws_access_key_id = p.accessKeyId;
    creds.default.aws_secret_access_key = p.secretAccessKey;
    creds.default.aws_session_token = p.sessionToken;
    creds.default.aws_access_token = p.accessToken;
    creds.default.aws_sso_authn = p.ssoAuthn;
  }

  const newcreds = stringify(creds);
  info(`saving updated default creds to .aws/credentials`);
  const credspath = getCredentialsFilepath();
  fs.writeFileSync(credspath, newcreds);
};
