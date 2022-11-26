/* eslint-disable padding-line-between-statements */
import { getAccessToken } from './helpers/oidc';
import {
  identityCenterInstanceArn,
  identityCenterRegion,
  ssoStartUrl,
} from './config';
import {
  ListAccountAssignmentsCommand,
  ListPermissionSetsCommand,
  SSOAdmin,
} from '@aws-sdk/client-sso-admin';
import {
  getCredentialsFromAccessToken,
  tryExistingCredentials,
} from './helpers/sso';
import { updateAwsCredentials } from './helpers/awsconfig';
import { info } from 'ag-common/dist/common/helpers/log';
import { IAwsCreds } from './types';
import { IAMClient } from '@aws-sdk/client-iam';
import fetch from 'node-fetch';

export async function run() {
  let accountId = '?';
  let credentials: IAwsCreds | undefined;
  const ec = await tryExistingCredentials({
    region: identityCenterRegion,
  });
  if (ec) {
    ({ credentials, accountId } = ec);
  }

  if (!credentials) {
    const accessToken = await getAccessToken({
      identityCenterRegion,
      ssoStartUrl,
    });
    ({ accountId, credentials } = await getCredentialsFromAccessToken({
      accessToken,
      region: identityCenterRegion,
    }));

    await updateAwsCredentials(credentials);
  }

  const admin = new SSOAdmin({ credentials });

  const ps = await admin.send(
    new ListPermissionSetsCommand({ InstanceArn: identityCenterInstanceArn }),
  );

  const PermissionSetArn = ps.PermissionSets?.[0];
  if (!PermissionSetArn) {
    throw new Error('no PermissionSetArn');
  }
  info(`permissionset=`, PermissionSetArn);

  const lcc = await admin.send(
    new ListAccountAssignmentsCommand({
      InstanceArn: identityCenterInstanceArn,
      AccountId: accountId,
      PermissionSetArn,
    }),
  );
  console.log('lcc=', lcc);

  // // const identityResult = await stsClient.send(new GetCallerIdentityCommand({}));

  // // console.log('identityResult=', identityResult);

  const x = await fetch(
    `https://portal.sso.us-east-1.amazonaws.com/instance/appinstances`,
    {
      headers: {
        'x-amz-sso-bearer-token': '',
      },
    },
  );
}
