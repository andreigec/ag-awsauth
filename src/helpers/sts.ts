import { STS } from '@aws-sdk/client-sts';
import { error, info, warn } from 'ag-common/dist/common/helpers/log';

import { nativeStsDurationSeconds, stsDurationSeconds } from '../config';
import { IAwsCreds, SearchMetadata } from '../types';
import { getAssumedRole } from './sso';

export async function validateCredentials(
  credentials: IAwsCreds,
): Promise<{ accountId: string; principalArn: string } | undefined> {
  const sts = new STS({
    credentials,
    region: credentials.region,
  });

  try {
    const stub = await sts.getCallerIdentity({});

    if (
      (stub?.$metadata?.httpStatusCode ?? 500) < 400 &&
      stub.Account &&
      stub.Arn
    ) {
      info(`test cached credentials OK`);
      return { accountId: stub.Account, principalArn: stub.Arn };
    }
  } catch (e) {
    const es = (e as Error).toString();
    if (es.includes('expired')) {
      warn('creds have expired');
    }
    warn('other saml error:' + es);
    return undefined;
  }
}

export async function getApplicationCreds(p: {
  originCreds: IAwsCreds;
  targetRegion: string;
  samlAssertion: string;
  providerArn: string;
  roleArn: string;
}): Promise<IAwsCreds> {
  const sts = new STS({
    credentials: p.originCreds,
    region: p.targetRegion,
  });

  const ret = await sts.assumeRoleWithSAML({
    PrincipalArn: p.providerArn,
    RoleArn: p.roleArn,
    SAMLAssertion: p.samlAssertion,
    DurationSeconds: stsDurationSeconds,
  });

  if ((ret.$metadata.httpStatusCode ?? 500) >= 400) {
    error('bad assume saml role', ret);
    throw new Error('bad assume saml role');
  }

  if (
    !ret?.Credentials?.AccessKeyId ||
    !ret?.Credentials?.SecretAccessKey ||
    !ret?.Credentials?.SessionToken
  ) {
    throw new Error('no creds');
  }
  return {
    ...p.originCreds,
    region: p.targetRegion,
    accessKeyId: ret.Credentials.AccessKeyId,
    secretAccessKey: ret.Credentials.SecretAccessKey,
    sessionToken: ret.Credentials.SessionToken,
  };
}

export async function directStsAssume(p: {
  credentials: IAwsCreds;
  targetRegion: string;
  metadata: SearchMetadata;
}) {
  const role = await getAssumedRole({
    accessToken: p.credentials.accessToken,
    accountId: p.metadata.AccountId,
  });

  const sts = new STS({
    credentials: p.credentials,
    region: p.targetRegion,
  });

  const ar = await sts.assumeRole({
    RoleArn: `arn:aws:iam::${role.accountId}:role/${role.roleName}`,
    RoleSessionName: 'awsauth',
    DurationSeconds: nativeStsDurationSeconds,
  });

  if ((ar.$metadata.httpStatusCode ?? 500) >= 400) {
    throw new Error('assume role error' + JSON.stringify(ar, null, 2));
  }

  if (
    !ar?.Credentials?.AccessKeyId ||
    !ar?.Credentials?.SecretAccessKey ||
    !ar?.Credentials?.SessionToken
  ) {
    throw new Error('no creds');
  }
  return {
    ...p.credentials,
    region: p.targetRegion,
    accessKeyId: ar.Credentials.AccessKeyId,
    secretAccessKey: ar.Credentials.SecretAccessKey,
    sessionToken: ar.Credentials.SessionToken,
  };
}
