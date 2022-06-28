const puppeteer = require('puppeteer-extra');

const randomUseragent = require('random-useragent');
const dbGen = require('./db');

// Pupeteer extra plugins
// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36';

async function createBrowser(options = {}) {
  const { args = [], ...restOptions } = options;
  return await puppeteer.launch({
    headless: false,
    slowMo: Math.random(5, 10),
    executablePath:
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      ...args,
      // '--proxy-server=http://127.0.0.1:8080/',
      //   '--disable-extensions-except=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      //   '--load-extension=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ],
    ...restOptions,
  });
}

async function createPage(browser, url) {
  //Randomize User agent or Set a valid one
  const userAgent = randomUseragent.getRandom();
  const UA = userAgent || USER_AGENT;
  const page = await browser.newPage();

  //Randomize viewport size
  await page.setViewport({
    width: 1440 + Math.floor(Math.random() * 100),
    height: 1000 + Math.floor(Math.random() * 100),
    deviceScaleFactor: 1,
    hasTouch: false,
    isLandscape: false,
    isMobile: false,
  });

  await page.setUserAgent(UA);
  await page.setJavaScriptEnabled(true);
  await page.setDefaultNavigationTimeout(0);

  //Skip images/styles/fonts loading for performance
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    // if (
    //   req.resourceType() == 'stylesheet' ||
    //   // req.resourceType() == 'image' ||
    //   req.resourceType() == 'font'
    // ) {
    //   req.abort();
    // } else {
    req.continue();
    // }
  });

  await page.evaluateOnNewDocument(() => {
    // Pass webdriver check
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  await page.evaluateOnNewDocument(() => {
    // Pass chrome check
    window.chrome = {
      runtime: {},
      // etc.
    };
  });

  await page.evaluateOnNewDocument(() => {
    //Pass notifications check
    const originalQuery = window.navigator.permissions.query;
    return (window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters));
  });

  // await page.evaluateOnNewDocument(() => {
  //   // Overwrite the `plugins` property to use a custom getter.
  //   Object.defineProperty(navigator, 'plugins', {
  //     // This just needs to have `length > 0` for the current test,
  //     // but we could mock the plugins too if necessary.
  //     get: () => [1, 2, 3, 4, 5],
  //   });
  // });

  // await page.evaluateOnNewDocument(() => {
  //   // Overwrite the `languages` property to use a custom getter.
  //   Object.defineProperty(navigator, 'languages', {
  //     get: () => ['en-US', 'en'],
  //   });
  // });

  await page.evaluateOnNewDocument(function () {
    navigator.geolocation.getCurrentPosition = function (cb) {
      setTimeout(() => {
        cb({
          coords: {
            accuracy: 21,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            latitude: 1.2890973,
            longitude: 103.84783774614333,
            speed: null,
          },
        });
      }, 1000);
    };
  });

  page.on('response', (r) => {
    if (r.request().isNavigationRequest() && r.frame() === page.mainFrame())
      console.log(`== NAVIGATION COMMITTED TO ${r.url()} ==`);
  });

  page.on('response', async (response) => {
    const req = response.request();
    let status = response.status();
    console.log({ status, url: req.url().split('?')[0] });
    if (
      req.url().startsWith('https://portal.grab.com/foodweb/v2') &&
      status == 200
    ) {
      console.log(req.url());
      console.log(' ');
      console.log({ status });
      try {
        const resJson = await response.json();
        const result = {};
        resJson.searchResult.searchMerchants.forEach((el) => {
          const { latlng, id, address } = el;
          result[id] = {
            id,
            name: address.name,
            latitude: latlng.latitude,
            longitude: latlng.longitude,
          };
        });
        const { hasMore, offset, totalCount } = resJson.searchResult;
        const meta = { hasMore, offset, totalCount };
        console.log(meta);
        dbGen().then((db) => {
          db.data.restaurants = { ...db.data.restaurants, ...result };
          db.data.meta = meta;
          db.write();
        });
      } catch (e) {
        console.log(e.message);
      }
      // console.log({ res1: await response.json() });
    }
  });

  page.on('responseerror');

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });
  return page;
}

module.exports = { createBrowser, createPage };
