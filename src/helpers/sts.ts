import { STS } from '@aws-sdk/client-sts';
import { info } from 'ag-common/dist/common/helpers/log';
import { IAwsCreds } from '../types';

export async function validateCredentials(
  credentials: IAwsCreds,
): Promise<{ accountId: string } | undefined> {
  const sts = new STS({
    credentials,
  });

  try {
    const stub = await sts.getCallerIdentity({});

    if ((stub?.$metadata?.httpStatusCode ?? 500) < 400 && stub.Account) {
      info(`test cached credentials OK`);
      return { accountId: stub.Account };
    }
  } catch (e) {
    //
  }
  return undefined;
}
