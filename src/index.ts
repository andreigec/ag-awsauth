/* eslint-disable padding-line-between-statements */
import {
  error,
  info,
  SetLogLevel,
  SetLogShim,
  warn,
} from 'ag-common/dist/common/helpers/log';
import fs from 'fs';

import {
  identityCenterRegion,
  logPath,
  ssoStartUrl,
  targetRegion,
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
// eslint-disable-next-line @typescript-eslint/no-var-requires
const beep = require('node-beep');

export async function main(args: IApplicationArgs) {
  SetLogLevel(args.verbose ? 'INFO' : 'WARN');
  SetLogShim((...a1) => {
    // eslint-disable-next-line no-console
    console.log(...a1);
    try {
      fs.appendFileSync(logPath, JSON.stringify(a1, null, 2));
    } catch (e) {
      //
    }
  });

  if (args.wipe) {
    info('wiping args');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateAwsCredentials(undefined);
    return;
  }

  let credentials = await tryExistingCredentials();

  if (!credentials?.accessToken || !credentials?.ssoAuthn) {
    info('no creds, get access token through manual sign in');
    credentials = await requestMFA({
      identityCenterRegion,
      ssoStartUrl,
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
    beep(1);
  } catch (e) {
    error('error:' + e);
    beep(2);
    if (e?.toString) {
      error('error:' + (e as Error).toString());
    }
  }
}
