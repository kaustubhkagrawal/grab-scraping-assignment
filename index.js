const dbGen = require('./db');
const { createBrowser, createPage } = require('./create-page');
// const BASE_URL = 'https://food.grab.com/sg/en/';
const BASE_URL =
  'https://food.grab.com/sg/en/cuisines/khuy%E1%BA%BFn-m%C3%A3i-delivery/305';
// 'https://food.grab.com/sg/en/restaurants?search=kfc';

const NEXT_DATA_SELECTOR = 'script#__NEXT_DATA__';
const LOAD_MORE_SELECTOR =
  '.sectionContent___2XGJB > .ant-layout > div > button.ant-btn.ant-btn-block ';

async function scrollDown(page, selector) {
  await page.$eval(selector, (e) => {
    e.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'end' });
  });
}

async function loadMoreListener(page) {
  try {
    await scrollDown(page, LOAD_MORE_SELECTOR);
  } catch (e) {
    console.log(e.message);
  }
  console.log('before click');
  // page.on('response', (response) => {
  //   if (
  //     response.url().startsWith('https://portal.grab.com/foodweb/v2') &&
  //     response.request().method() === 'POST'
  //   ) {
  //     console.log({ res1: response });
  //   }
  // });

  await page.waitForSelector(LOAD_MORE_SELECTOR);
  await page.click(LOAD_MORE_SELECTOR);
  console.log('after click');

  // const finalResponse = await page.waitForResponse((response) => {
  //   console.log({ url: response.url() });
  //   return response.url().startsWith('https://portal.grab.com/foodweb/v2');
  // }, 15);

  // // await page.waitForTimeout(10000);
  // console.log(finalResponse);
  // let responseJson = await finalResponse.json();

  // console.log(responseJson);

  await page.waitForTimeout(Math.random() * 56323 + 20529);
  // return responseJson;
}

async function main(location) {
  try {
    const browser = await createBrowser({});
    const homePage = await createPage(browser, BASE_URL);
    await homePage.waitForSelector(NEXT_DATA_SELECTOR);

    const pageRawData = await homePage.evaluateHandle((sel) => {
      let el = document.querySelector(sel);
      return el.innerHTML;
    }, NEXT_DATA_SELECTOR);
    const pageData = JSON.parse(await pageRawData.jsonValue());

    // let initialData = Object.values(
    //   pageData.props.initialReduxState.pageRestaurantsV2.entities.restaurantList
    // ).map((el) => {
    //   const { id, name, latitude, longitude } = el;
    //   return { id, name, latitude, longitude };
    // });

    let restaurants = {};

    Object.values(
      pageData.props.initialReduxState.pageRestaurantsV2.entities.restaurantList
    ).forEach((el) => {
      const { id, name, latitude, longitude } = el;
      restaurants[id] = { id, name, latitude, longitude };
    });

    const db = await dbGen();
    db.data.restaurants = restaurants;
    await db.write();

    let flag = true;
    while (flag) {
      await loadMoreListener(homePage);
      await db.read();
      flag = db.data.meta.hasMore;
    }

    await await browser.close();
  } catch (err) {
    console.log(err.message);
  }
}

let test_location =
  'Manila Construction - No. 80, Airport Boulevard, Singapore, Singapore, 819642';
main(test_location);
