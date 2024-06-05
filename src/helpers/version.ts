import { warn } from 'ag-common/dist/common/helpers/log';
import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

export const getVersion = () => {
  let pjpath = path.resolve(__dirname, './package.json');
  if (!fs.existsSync(pjpath)) {
    pjpath = path.resolve(__dirname, '../package.json');
  }
  if (!fs.existsSync(pjpath)) {
    pjpath = path.resolve(__dirname, '../../package.json');
  }
  if (!fs.existsSync(pjpath)) {
    return undefined;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const p = require(pjpath);
  return p?.version;
};

interface ITag {
  name: string;
}
const getUpstreamVersion = async () => {
  try {
    const r = await fetch(
      'https://api.github.com/repos/andreigec/ag-awsauth/tags',
      { headers: { Accept: 'application/json' } },
    );
    const tags = (await r.json()) as ITag[];
    return tags[0]?.name;
  } catch (e) {
    warn(`error getting upstream version:` + (e as Error).message);
    return undefined;
  }
};
export const validateVersion = async () => {
  const v = getVersion();

  const upstream = await getUpstreamVersion();
  if (!v || !upstream) {
    return;
  }
  if (v !== upstream) {
    warn(
      `
      ---
      There is a new version of ag-awsauth available.
      Your version: ${v}
      Newest version: ${upstream}
      Upgrade using npm i -g ag-awsauth
      ---\n`,
    );
  }
};
