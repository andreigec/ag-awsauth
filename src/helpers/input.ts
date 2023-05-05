import { info } from 'ag-common/dist/common/helpers/log';
import { containsInsensitive } from 'ag-common/dist/common/helpers/string';
import cliSelect from 'cli-select';
import { question } from 'readline-sync';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { IAppInstance, IApplicationArgs } from '../types';

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
  const { version, applicationfilter, verbose, wipe, config } = await yargs(
    hideBin(process.argv),
  )
    .help('h')
    .alias('h', 'help')

    .option('applicationfilter', {
      alias: 'af',
      type: 'string',
      description: 'Will select account that matches passed in string',
    })

    .option('verbose', {
      alias: 'v',
      type: 'boolean',
      description: 'Run with verbose logging',
      default: false,
    })

    .option('wipe', {
      alias: 'w',
      type: 'boolean',
      description: 'Clear previously saved session details and quit',
      default: false,
    })

    .option('config', {
      alias: 'c',
      type: 'boolean',
      description: 'Configure application settings',
      default: false,
    })

    .option('version', {
      type: 'boolean',
      description: 'Show application version',
      default: false,
    })

    .parse();

  return { applicationfilter, verbose, wipe, config, version };
}

export function enterCreds() {
  const username = question('Enter username:');
  const password = question('Enter password:', {
    hideEchoBack: true,
  });

  return { username, password };
}

export function enterMFA() {
  return {
    mfa: question('Enter MFA code:', {
      min: 6,
      max: 6,
      hideEchoBack: true,
    }),
  };
}
