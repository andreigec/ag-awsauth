import { homedir } from 'os';
import { join, sep } from 'path';

const homeDirCache: Record<string, string> = {};

const getHomeDirCacheKey = (): string => {
  // geteuid is only available on POSIX platforms (i.e. not Windows or Android).
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (process && process.geteuid) {
    return `${process.geteuid()}`;
  }
  return 'DEFAULT';
};
export const getHomeDir = (): string => {
  const { HOME, USERPROFILE, HOMEPATH, HOMEDRIVE = `C:${sep}` } = process.env;

  if (HOME) return HOME;
  if (USERPROFILE) return USERPROFILE;
  if (HOMEPATH) return `${HOMEDRIVE}${HOMEPATH}`;

  const homeDirCacheKey = getHomeDirCacheKey();
  if (!homeDirCache[homeDirCacheKey]) homeDirCache[homeDirCacheKey] = homedir();

  return homeDirCache[homeDirCacheKey];
};

export const ENV_CREDENTIALS_PATH = 'AWS_SHARED_CREDENTIALS_FILE';

export const getCredentialsFilepath = () =>
  process.env[ENV_CREDENTIALS_PATH] ||
  join(getHomeDir(), '.aws', 'credentials');
