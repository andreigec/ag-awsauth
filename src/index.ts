/* eslint-disable padding-line-between-statements */
import { appInstances, getAccessToken, getSamlAssertion } from './helpers/oidc';
import { identityCenterRegion, ssoStartUrl } from './config';
import {
  getOIDCCredentialsFromAccessToken,
  tryExistingCredentials,
} from './helpers/sso';
import { updateAwsCredentials } from './helpers/awsconfig';
import { warn } from 'ag-common/dist/common/helpers/log';
import { chooseAppInstance } from './helpers/input';
import { getApplicationCreds } from './helpers/sts';

export async function run() {
  let credentials = await tryExistingCredentials();

  if (!credentials?.accessToken || !credentials?.ssoAuthn) {
    warn('no creds, get access token through manual sign in');
    const ac = await getAccessToken({
      identityCenterRegion,
      ssoStartUrl,
    });
    credentials = {
      ...ac,
      accessKeyId: '',
      region: identityCenterRegion,
      secretAccessKey: '',
      sessionToken: '',
    };
  }
  warn('get oidc creds');
  credentials = await getOIDCCredentialsFromAccessToken(credentials);
  //

  warn('save aws creds to file');
  await updateAwsCredentials(credentials);

  warn('get app instances and display');
  const instances = await appInstances(credentials);
  const instance = await chooseAppInstance(instances);

  if (instance.searchMetadata) {
    warn('account is native aws, directly  connecting');
  } else {
    warn('account is external app, getting saml');
    const samlDetails = await getSamlAssertion(credentials, instance);

    credentials = await getApplicationCreds({
      ...samlDetails,
      originCreds: credentials,
      targetRegion: 'ap-southeast-2',
    });
  }

  await updateAwsCredentials(credentials);
}
