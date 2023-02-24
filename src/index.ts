/* eslint-disable padding-line-between-statements */
import {
  error,
  info,
  SetLogLevel,
  SetLogShim,
  warn,
} from 'ag-common/dist/common/helpers/log';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

import {
  basePath,
  identityCenterRegion,
  logPath,
  runConfig,
  setBasePath,
  ssoStartUrl,
  targetRegion,
  validateConfig,
} from './config';
import { updateAwsCredentials } from './helpers/awsconfig';
import { chooseAppInstance, readArguments } from './helpers/input';
import { requestMFA } from './helpers/oidc';
import {
  appInstances,
  getOIDCCredentialsFromAccessToken,
  getSamlAssertion,
  tryExistingCredentials,
} from './helpers/sso';
import { directStsAssume, getApplicationCreds } from './helpers/sts';
import { IApplicationArgs } from './types';

if (__dirname.endsWith('dist')) {
  setBasePath(path.resolve(__dirname, '../'));
} else {
  setBasePath(__dirname);
}

config({ path: basePath + '/.env' });

export let globalargs: IApplicationArgs | undefined;
export async function main(args: IApplicationArgs) {
  globalargs = args;
  SetLogLevel(args.verbose ? 'TRACE' : 'WARN');
  SetLogShim((...a1) => {
    // eslint-disable-next-line no-console
    console.log(...a1);
    try {
      fs.appendFileSync(logPath, JSON.stringify(a1, null, 2));
    } catch (e) {
      //
    }
  });

  if (args.config) {
    info('running config');
    runConfig();
    return;
  }

  if (args.wipe) {
    info('wiping args');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateAwsCredentials(undefined);
    return;
  }

  if (!validateConfig()) {
    // eslint-disable-next-line no-console
    console.error('please run config (-c)');

    return;
  }

  let credentials = await tryExistingCredentials();

  if (!credentials?.accessToken || !credentials?.ssoAuthn) {
    info('no creds, get access token through manual sign in');
    credentials = await requestMFA({
      identityCenterRegion: identityCenterRegion,
      ssoStartUrl: ssoStartUrl,
    });
    info('get oidc creds');
    credentials = await getOIDCCredentialsFromAccessToken(credentials);
  }

  //

  info('save aws creds to file');
  await updateAwsCredentials(credentials);

  info('get app instances and display');
  const instances = await appInstances(credentials);
  const instance = await chooseAppInstance(instances, args);

  let debugRole = '';

  if (instance.searchMetadata) {
    info('account is native aws, directly  connecting');
    credentials = await directStsAssume({
      credentials,
      targetRegion,
      metadata: instance.searchMetadata,
    });

    debugRole = instance.searchMetadata.AccountId;
  } else {
    info('account is external app, getting saml');
    const samlDetails = await getSamlAssertion(credentials, instance);

    credentials = await getApplicationCreds({
      ...samlDetails,
      originCreds: credentials,
      targetRegion,
    });
    debugRole = samlDetails.roleArn;
  }

  await updateAwsCredentials(credentials);
  warn(`successfully authed into ${debugRole}`);
}

export async function run() {
  try {
    const args = await readArguments();
    await main(args);
  } catch (e) {
    error('error:' + e);

    if (e?.toString) {
      error('error:' + (e as Error).toString());
    }
  }
}
