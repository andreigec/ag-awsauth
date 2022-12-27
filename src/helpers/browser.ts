import { debug, error, info, warn } from 'ag-common/dist/common/helpers/log';
import { sleep } from 'ag-common/dist/common/helpers/sleep';
import {
  Browser,
  BrowserConnectOptions,
  BrowserLaunchArgumentOptions,
  launch,
  LaunchOptions,
} from 'puppeteer';

import { enterMFA } from './input';

let browser: Browser | undefined;

export const closeBrowser = async () => {
  try {
    if (!browser) {
      return;
    }

    await browser.close();
    browser = undefined;
  } catch (e) {
    warn('error closing browser:', e);
  }
};

export const launchBrowser = async () => {
  const opt: LaunchOptions &
    BrowserLaunchArgumentOptions &
    BrowserConnectOptions = {
    defaultViewport: { height: 1000, width: 500 },
    headless: true, //chromium.headless,
    ignoreHTTPSErrors: true,
    devtools: false,
  };

  if (!opt.args) {
    opt.args = [];
  }

  opt.args.push('--disable-features=AudioServiceOutOfProcess');
  opt.args.push('--disable-features=AudioServiceOutOfProcessKillAtHang');
  opt.args.push('--disable-software-rasterizer');
  opt.args.push('--disable-gpu');
  opt.args.push('--disable-dev-shm-usage');
  await closeBrowser();
  debug('launch browser, opt=', opt);
  browser = (await launch(opt)) as unknown as Browser;

  debug('browser created');
};

export const goToPage = async (url: string) => {
  try {
    if (!browser) {
      await launchBrowser();
    }

    if (!browser) {
      throw new Error('no browser');
    }

    info(`go to page:${url}`);

    const page = await browser.newPage();
    await page.goto(url, {
      waitUntil: ['networkidle2'],
      timeout: 10000,
    });
    return page;
  } catch (e) {
    const em = 'browser error:' + (e as Error).toString();
    error(em);
    throw new Error(em);
  }
};

export async function getMFA(p: {
  verificationUriComplete: string;
  creds: { username: string; password: string };
}) {
  //go to browser site for auth
  info('start mfa');
  const page = await goToPage(p.verificationUriComplete);
  info('username block');
  await page.waitForSelector('#username-input');
  await page.focus('#username-input input');
  await page.keyboard.type(p.creds.username);
  await page.$eval('#username-submit-button button', (el) =>
    (el as HTMLButtonElement).click(),
  );

  //
  info('password block');
  await page.waitForSelector('#password-input');
  await page.focus('#password-input input');
  await page.keyboard.type(p.creds.password);
  await page.$eval('#password-submit-button button', (el) =>
    (el as HTMLButtonElement).click(),
  );

  await sleep(250);
  await page.waitForNetworkIdle({ idleTime: 250 });
  //

  try {
    const messageDiv = await page.waitForSelector('.awsui-alert-message', {
      timeout: 2000,
    });

    const value = await page.evaluate(
      (el) => el?.textContent ?? '',
      messageDiv,
    );

    if (value) {
      throw new Error(value);
    }
  } catch (e) {
    const em = (e as Error).toString();
    if (!em.includes('exceeded')) {
      const em2 = `creds error:` + em;
      error(em2);
      throw new Error(em2);
    }
  }

  //
  let retry = true;
  do {
    info('mfa block');
    const { mfa } = enterMFA();
    await page.waitForSelector('#input-0');
    await page.focus('#input-0 input');
    await page.keyboard.type(mfa);
    await page.$eval('.awsui-signin-button-container button', (el) =>
      (el as HTMLButtonElement).click(),
    );

    //
    try {
      await sleep(250);
      await page.waitForNetworkIdle({ idleTime: 250 });
      const messageDiv = await page.waitForSelector('.awsui-alert-message', {
        timeout: 2000,
      });

      const value = await page.evaluate(
        (el) => el?.textContent ?? '',
        messageDiv,
      );

      if (value) {
        throw new Error(value);
      }

      retry = false;
    } catch (e) {
      const em = (e as Error).toString();
      if (!em.includes('exceeded')) {
        const em2 = `mfa error:` + em + ' retry';
        error(em2);
      } else {
        retry = false;
      }
    }
  } while (retry);
  //
  await sleep(3000);
  await page.waitForNetworkIdle({ idleTime: 250 });
  await page.waitForSelector('#cli_login_button', { timeout: 5000 });
  await page.$eval('#cli_login_button', (el) =>
    (el as HTMLButtonElement).click(),
  );

  await sleep(250);
  await page.waitForNetworkIdle({ idleTime: 250 });
  await page.waitForSelector('.awsui-icon-variant-success', { timeout: 5000 });
  warn('mfa success');

  const cookies = await page?.cookies();
  const ssoAuthn = cookies?.find((c) => c.name === 'x-amz-sso_authn')?.value;

  if (!ssoAuthn) {
    throw new Error('no aws authn');
  }

  await closeBrowser();
  return { ssoAuthn };
}
