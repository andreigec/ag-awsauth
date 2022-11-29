import { IAppInstance } from '../types';
import cliSelect from 'cli-select';
import { warn } from 'ag-common/dist/common/helpers/log';

export async function chooseAppInstance(ai: IAppInstance[]) {
  warn('Choose app instance to connect to');
  const res = await cliSelect({
    values: ai,
    valueRenderer: (a) => a.name + ':' + a.applicationId,
  });

  return res.value;
}
