import { parse, stringify } from 'envfile';
import fs from 'fs';
import path from 'path';

export const logPath = 'log.txt';
export const stsDurationSeconds = 60 * 60 * 4; //4h
export const nativeStsDurationSeconds = 60 * 60 * 1; //1h
export const identityCenterRegion = () =>
  process.env.identityCenterRegion as string;
export const ssoStartUrl = () => process.env.ssoStartUrl as string;
export const targetRegion = () => process.env.targetRegion as string;

export const validateConfig = () => {
  if (!identityCenterRegion() || !ssoStartUrl() || !targetRegion()) {
    return false;
  }

  return true;
};

export const runConfig = () => {
  const pn = path.resolve(__dirname + '/../.env');
  if (!fs.existsSync(pn)) {
    fs.writeFileSync(pn, '');
  }
  const c = parse(fs.readFileSync(pn).toString());
  if (!c.ssoStartUrl) {
    c.ssoStartUrl = ' //eg https://d-xxx.awsapps.com/start';
  }
  if (!c.targetRegion) {
    c.targetRegion = ' //eg ap-southeast-1';
  }
  if (!c.identityCenterRegion) {
    c.identityCenterRegion = ' //eg us-east-1';
  }
  fs.writeFileSync(pn, stringify(c));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('child_process').exec(`start "" "${pn}"`);
};
