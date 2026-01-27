/**
 * Auth.js - Manual Login & Session Saver
 * 
 * This script opens Loket.com, allows you to login manually,
 * and saves the session (cookies + localStorage) to session.json
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

// Apply stealth plugin
chromium.use(stealth);

const SESSION_FILE = path.join(__dirname, 'session.json');
const LOKET_LOGIN_URL = 'https://www.loket.com/login';
const LOKET_HOME_URL = 'https://www.loket.com';

async function main() {
  logger.banner();
  logger.info('Starting authentication flow...');
  logger.info('A browser window will open. Please login manually.');
  
  let browser;
  
  try {
    // Launch browser with stealth mode
    browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });
    
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'id-ID',
      timezoneId: 'Asia/Jakarta'
    });
    
    const page = await context.newPage();
    
    // Navigate to login page
    logger.info('Navigating to Loket.com login page...');
    await page.goto(LOKET_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    logger.warn('='.repeat(50));
    logger.warn('PLEASE LOGIN MANUALLY IN THE BROWSER WINDOW');
    logger.warn('The bot will detect when you are logged in');
    logger.warn('='.repeat(50));
    
    // Wait for successful login by detecting URL change or user element
    let isLoggedIn = false;
    let attempts = 0;
    const maxAttempts = 600; // 5 minutes timeout (500ms * 600)
    
    while (!isLoggedIn && attempts < maxAttempts) {
      await page.waitForTimeout(500);
      attempts++;
      
      // Check for login indicators
      const currentUrl = page.url();
      
      // Check if redirected away from login page
      if (!currentUrl.includes('/auth/login') && !currentUrl.includes('/login')) {
        // Verify we're actually logged in by checking for user elements
        try {
          // Look for common logged-in indicators
          const userIndicators = [
            '.user-avatar',
            '.profile-avatar',
            '[class*="avatar"]',
            '.user-menu',
            '[class*="user-dropdown"]',
            'a[href*="logout"]',
            'button:has-text("Logout")',
            '.navbar-user'
          ];
          
          for (const selector of userIndicators) {
            const element = await page.$(selector);
            if (element) {
              isLoggedIn = true;
              break;
            }
          }
          
          // Also check if we're on a page that requires login
          if (currentUrl.includes('loket.com') && 
              !currentUrl.includes('login') && 
              !currentUrl.includes('register')) {
            // Give some extra time for page to fully load
            await page.waitForTimeout(2000);
            isLoggedIn = true;
          }
        } catch (e) {
          // Continue waiting
        }
      }
      
      // Show progress every 10 seconds
      if (attempts % 20 === 0) {
        logger.queue(`Waiting for login... (${Math.floor(attempts / 2)}s elapsed)`);
      }
    }
    
    if (!isLoggedIn) {
      logger.error('Login timeout! Please try again.');
      await browser.close();
      process.exit(1);
    }
    
    logger.success('Login detected! Saving session...');
    
    // Navigate to home to ensure all cookies are set
    await page.goto(LOKET_HOME_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Save storage state (cookies + localStorage)
    const storageState = await context.storageState();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(storageState, null, 2));
    
    logger.success(`Session saved to: ${SESSION_FILE}`);
    logger.info('You can now close this browser and run the bot with: npm start');
    
    // Keep browser open for a moment so user can see the success
    await page.waitForTimeout(3000);
    
    await browser.close();
    logger.success('Authentication complete!');
    
  } catch (error) {
    logger.error(`Error during authentication: ${error.message}`);
    if (browser) await browser.close();
    process.exit(1);
  }
}

// Run
main().catch(console.error);
