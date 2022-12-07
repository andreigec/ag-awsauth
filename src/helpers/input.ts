import { IAppInstance, IApplicationArgs } from '../types';
import cliSelect from 'cli-select';
import { info } from 'ag-common/dist/common/helpers/log';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { containsInsensitive } from 'ag-common/dist/common/helpers/string';
import prompt from 'readline-sync';
const valueRenderer = (a: IAppInstance) => `${a.name} [${a.id}]`;

export async function chooseAppInstance(
  ai: IAppInstance[],
  args: IApplicationArgs,
) {
  let ret: IAppInstance | undefined;
  if (args.applicationfilter) {
    ret = ai.find((a) =>
      containsInsensitive(valueRenderer(a), args.applicationfilter as string),
    );
    if (!ret) {
      throw new Error('didnt find application with filter');
    }
  }

  if (ret) {
    info(
      `preselecting ${valueRenderer(ret)} from input ${args.applicationfilter}`,
    );
    return ret;
  }

  info('Choose app instance to connect to');
  const res = await cliSelect({
    values: ai,
    valueRenderer,
  });

  return res.value;
}

export async function readArguments(): Promise<IApplicationArgs> {
  const { applicationfilter, verbose, wipe } = await yargs(
    hideBin(process.argv),
  )
    .help('h')
    .alias('h', 'help')
    .option('applicationfilter', {
      alias: 'af',
      type: 'string',
      description: 'Will select account that matches passed in string',
    })
    .boolean('verbose')
    .alias('v', 'verbose')
    .default('verbose', true)
    .boolean('wipe')
    .alias('w', 'wipe')
    .default('wipe', false)
    .parse();

  return { applicationfilter, verbose, wipe };
}

export function enterCreds() {
  const username = prompt.question('Enter username:');
  const password = prompt.question('Enter password:', {
    hideEchoBack: true,
  });

  return { username, password };
}

export function enterMFA() {
  return { mfa: prompt.question('Enter MFA code:', { min: 6, max: 6 }) };
}
