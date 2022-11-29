import { STS } from '@aws-sdk/client-sts';
import { error, info } from 'ag-common/dist/common/helpers/log';
import { IAwsCreds, SearchMetadata } from '../types';
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
    throw new Error('saml error:' + e);
    //
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
  const sts = new STS({
    credentials: p.credentials,
    region: p.targetRegion,
  });

  const ar = await sts.assumeRole({
    RoleArn: `arn:aws:iam::${p.metadata.AccountId}:role/awsSaml`,
    RoleSessionName: 'awsauth',
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
    accessKeyId: ar.Credentials.AccessKeyId,
    secretAccessKey: ar.Credentials.SecretAccessKey,
    sessionToken: ar.Credentials.SessionToken,
  };
}
