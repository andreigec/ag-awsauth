import {
  Browser,
  BrowserConnectOptions,
  BrowserLaunchArgumentOptions,
  LaunchOptions,
  PuppeteerNode,
} from 'puppeteer';
import chromium from '@sparticuz/chrome-aws-lambda';
import { debug, info, warn } from 'ag-common/dist/common/helpers/log';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const puppeteer: PuppeteerNode = undefined as any;
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
    args: chromium.args,
    executablePath: await chromium.executablePath,
    headless: false, //chromium.headless,
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
  browser = (await (puppeteer ?? chromium.puppeteer).launch(
    opt,
  )) as unknown as Browser;

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
    console.log('e=', e);
  }
};
