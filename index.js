const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const readline = require('readline');
require('dotenv').config();

// Target Policy Pages Configuration with Fallback Routes
const TARGET_PAGE_TYPES = [
  { 
    name: '01_Home_Page', 
    keywords: ['home', 'index'],
    fallbacks: ['/']
  },
  { 
    name: '02_Privacy_Policy', 
    keywords: ['privacy-policy', 'privacy', 'gopniyata'],
    fallbacks: ['/pages/privacy-policy', '/policies/privacy-policy', '/privacy-policy']
  },
  { 
    name: '03_Terms_And_Conditions', 
    keywords: ['terms-and-conditions', 'terms-of-service', 'terms', 'tc', 'tos', 'conditions'],
    fallbacks: ['/pages/terms-and-conditions', '/pages/terms-of-service', '/policies/terms-of-service', '/terms-and-conditions']
  },
  { 
    name: '04_Contact_Us', 
    keywords: ['contact-us', 'contact', 'reach-us', 'support'],
    fallbacks: ['/pages/contact-us', '/pages/contact', '/contact-us', '/contact']
  },
  { 
    name: '05_Shipping_Policy', 
    keywords: ['shipping-policy', 'shipping', 'delivery-policy', 'delivery', 'dispatch'],
    fallbacks: ['/pages/shipping-policy', '/pages/shipping', '/policies/shipping-policy', '/shipping-policy']
  },
  { 
    name: '06_Product_Pricing_Services', 
    keywords: ['pricing', 'pricing-plans', 'products', 'services', 'plans', 'shop', 'collections'],
    fallbacks: ['/collections/all', '/collections', '/shop', '/products']
  }
];

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function capturePolicyScreenshots() {
  let targetUrl = await askQuestion('\n🌐 Enter Website URL: ');
  targetUrl = targetUrl.trim();

  if (!targetUrl) {
    console.error("❌ Invalid URL entered.");
    process.exit(1);
  }

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  const userHome = os.homedir();
  const domainName = new URL(targetUrl).hostname.replace(/[^a-zA-Z0-9]/g, '_');
  const outputDir = path.join(userHome, 'Downloads', `Website_Policy_Screenshots_${domainName}`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\n🚀 Starting Enhanced Screenshot Downloader for: ${targetUrl}`);
  console.log(`📁 Saving Screenshots to: ${outputDir}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Block unnecessary third-party ads & analytics scripts for speed
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (
      url.includes('google-analytics') || 
      url.includes('facebook') || 
      url.includes('doubleclick') || 
      url.includes('hotjar') ||
      url.includes('clarity.ms')
    ) {
      route.abort();
    } else {
      route.continue();
    }
  });

  try {
    console.log(`⏳ Navigating to Home Page...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000); 

    // Home Page Full Screenshot
    const homeScreenshotPath = path.join(outputDir, '01_Home_Page.png');
    await page.screenshot({ path: homeScreenshotPath, fullPage: true });
    console.log(`✅ [1/6] Captured: Home Page`);

    // Extract all links including text and hrefs
    const allLinks = await page.$$eval('a', anchors => {
      return anchors.map(a => ({
        text: (a.innerText || '').toLowerCase().trim(),
        href: a.href || ''
      })).filter(item => item.href && item.href.startsWith('http'));
    });

    function findMatchingLink(keywords) {
      for (const item of allLinks) {
        const urlLower = item.href.toLowerCase();
        const textLower = item.text;
        for (const kw of keywords) {
          if (urlLower.includes(kw) || textLower.includes(kw)) {
            return item.href;
          }
        }
      }
      return null;
    }

    // Capture other Policy Pages
    const baseUrl = new URL(targetUrl).origin;

    for (let i = 1; i < TARGET_PAGE_TYPES.length; i++) {
      const policy = TARGET_PAGE_TYPES[i];
      let targetPageUrl = findMatchingLink(policy.keywords);

      // Fallback mechanism: Try standard routes if link was not found on home page DOM
      const urlsToTry = [];
      if (targetPageUrl) {
        urlsToTry.push(targetPageUrl);
      }
      policy.fallbacks.forEach(fallbackPath => {
        urlsToTry.push(`${baseUrl}${fallbackPath}`);
      });

      let captured = false;

      for (const currentUrl of urlsToTry) {
        try {
          console.log(`⏳ Capturing ${policy.name}... (${currentUrl})`);
          const response = await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          
          if (response && response.status() < 400) {
            await page.waitForTimeout(1500);
            
            // Auto scroll down to trigger lazy loading elements
            await page.evaluate(async () => {
              await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 300;
                const timer = setInterval(() => {
                  const scrollHeight = document.body.scrollHeight;
                  window.scrollBy(0, distance);
                  totalHeight += distance;
                  if (totalHeight >= scrollHeight || totalHeight > 5000) {
                    clearInterval(timer);
                    resolve();
                  }
                }, 100);
              });
            });

            const savePath = path.join(outputDir, `${policy.name}.png`);
            await page.screenshot({ path: savePath, fullPage: true });
            console.log(`✅ [${i + 1}/6] Saved: ${policy.name}`);
            captured = true;
            break;
          }
        } catch (err) {
          // Continue trying next fallback route
        }
      }

      if (!captured) {
        console.log(`Could not capture: ${policy.name}`);
      }
    }

  } catch (error) {
    console.error(`Error: ${error.message}`);
  } finally {
    await browser.close();
    console.log(`SS Done! Screenshots saved in: ${outputDir}\n`);
  }
}

capturePolicyScreenshots();