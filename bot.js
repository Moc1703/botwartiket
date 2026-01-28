/**
 * Bot.js - The War Engine
 * 
 * High-speed ticket buying bot for Loket.com
 * Features:
 * - Session loading (skip login)
 * - 100ms polling for ticket availability
 * - Waiting room detection
 * - Category selection with fallback
 * - Auto form filling
 * - Payment page navigation
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const { selectors, findElement, elementExists } = require('./utils/selectors');

// Apply stealth plugin
chromium.use(stealth);

// File paths
const SESSION_FILE = path.join(__dirname, 'session.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Load configuration
function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    logger.error('config.json not found! Please copy config.example.json to config.json and fill in your details.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

// Load session
function loadSession() {
  if (!fs.existsSync(SESSION_FILE)) {
    logger.error('session.json not found! Please run "npm run auth" first to login.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
}

// Check if we're in waiting room
function isWaitingRoom(url) {
  return selectors.waitingRoom.urlPatterns.some(pattern => 
    url.toLowerCase().includes(pattern)
  );
}

// Wait for buy button with high-frequency polling
async function waitForBuyButton(page, pollInterval) {
  logger.war('WAR MODE ACTIVATED - Scanning for ticket button...');
  
  let found = false;
  let iterations = 0;
  
  while (!found) {
    iterations++;
    
    // Check current URL for waiting room
    const currentUrl = page.url();
    if (isWaitingRoom(currentUrl)) {
      if (iterations % 50 === 1) { // Log every ~5 seconds
        logger.queue('In waiting room - staying patient, NOT refreshing...');
      }
      await page.waitForTimeout(pollInterval);
      continue;
    }
    
    // Try to find the buy button
    for (const selector of selectors.event.buyButton) {
      try {
        const button = await page.$(selector);
        if (button) {
          const isDisabled = await button.isDisabled();
          const isVisible = await button.isVisible();
          
          if (isVisible && !isDisabled) {
            logger.success(`Buy button found after ${iterations} iterations!`);
            found = true;
            return button;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // Log progress periodically
    if (iterations % 100 === 0) {
      logger.info(`Still scanning... (${iterations * pollInterval / 1000}s elapsed)`);
    }
    
    await page.waitForTimeout(pollInterval);
  }
}

// Select ticket category based on keywords
async function selectCategory(page, categoryKeywords, ticketAmount) {
  logger.info('Looking for ticket categories...');
  
  await page.waitForTimeout(2000); // Wait for categories to load
  
  // Debug: Show current URL
  const currentUrl = page.url();
  logger.info(`Current URL: ${currentUrl}`);
  
  // Debug: List all buttons on the page
  const allButtons = await page.$$('button');
  logger.info(`Found ${allButtons.length} total buttons on page`);
  
  for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
    try {
      const btnText = await allButtons[i].textContent();
      const btnVisible = await allButtons[i].isVisible();
      logger.info(`  Button ${i + 1}: "${btnText?.trim().substring(0, 30)}" (visible: ${btnVisible})`);
    } catch (e) {}
  }
  
  // Try clicking any button that contains "Select" text directly
  try {
    // Quick stabilization wait
    await page.waitForTimeout(300);
    
    // Find the actual button containing "Select" text (not just the text)
    logger.info('Looking for Select button...');
    
    // Strategy 1: Find button that contains Select text
    const selectButtonSelectors = [
      'button:has-text("Select")',
      'button:has-text("Pilih")',
      '[role="button"]:has-text("Select")',
      'div[class*="select"]:has-text("Select")',
      // Button with blue background (common for CTAs)
      'button.bg-blue-500',
      'button.btn-primary',
      'button[class*="primary"]',
      'button[class*="select"]'
    ];
    
    let clicked = false;
    
    for (const selector of selectButtonSelectors) {
      try {
        const btn = await page.locator(selector).first();
        const isVis = await btn.isVisible({ timeout: 500 }).catch(() => false);
        if (isVis) {
          logger.info(`Found visible button with selector: ${selector}`);
          
          // Get bounding box to verify it's clickable
          const box = await btn.boundingBox();
          if (box) {
            logger.info(`Button position: x=${box.x}, y=${box.y}, w=${box.width}, h=${box.height}`);
            
            // Click in the center of the button
            await btn.click({ timeout: 5000 });
            logger.success('Clicked on Select button!');
            clicked = true;
            
            await page.waitForTimeout(500);
            
            // Check if dropdown appeared or page changed
            const newUrl = page.url();
            logger.info(`After click URL: ${newUrl}`);
            
            // List visible elements now
            const allVis = await page.locator('button:visible, [role="button"]:visible, a:visible').count();
            logger.info(`Visible interactive elements after click: ${allVis}`);
            
            // Look for quantity dropdown options (visible numbers 1, 2, 3, 4, 5)
            logger.info('Looking for quantity dropdown options...');
            
            // The dropdown shows numbers 1-5, need to click on the desired quantity
            const qtyText = String(ticketAmount);
            const qtySelectors = [
              // Direct text matching for numbers in dropdown
              `text="${qtyText}"`,
              `div:has-text("${qtyText}"):not(:has(*:has-text("${qtyText}")))`,  // Leaf node with text
              `span:text-is("${qtyText}")`,
              `li >> text="${qtyText}"`,
              `[role="option"]:has-text("${qtyText}")`,
              // Any clickable element with just the number
              `div:text-is("${qtyText}")`,
              `p:text-is("${qtyText}")`,
              // Fallback: first item in any list
              'ul li:first-child',
              '[role="listbox"] [role="option"]:first-child',
              // Try getting all visible text elements with "1"
              'div.visible:has-text("1")'
            ];
            
            let qtyClicked = false;
            for (const qtySel of qtySelectors) {
              try {
                const qtyEl = await page.locator(qtySel).first();
                const isVis = await qtyEl.isVisible({ timeout: 300 }).catch(() => false);
                if (isVis) {
                  logger.info(`Found quantity option: ${qtySel}`);
                  await qtyEl.click();
                  logger.success(`Selected quantity: ${qtyText}`);
                  qtyClicked = true;
                  break;
                }
              } catch (e) {}
            }
            
            if (!qtyClicked) {
              // Try clicking by coordinates - dropdown items are usually below the Select button
              logger.info('Trying to click first dropdown option by position...');
              // Click slightly below the Select button (first dropdown option)
              await page.mouse.click(box.x + box.width / 2, box.y + box.height + 20);
              logger.info('Clicked on estimated dropdown position');
            }
            
            await page.waitForTimeout(400);
            
            // Look for any "Order Now", "Continue", "Proceed" button
            const proceedSelectors = [
              'button:has-text("Order Now")',
              'button:has-text("Order")',
              'button:has-text("Continue")',
              'button:has-text("Proceed")',
              'button:has-text("Checkout")',
              'button:has-text("Lanjutkan")',
              'button:has-text("Pesan")',
              'button[type="submit"]:visible'
            ];
            
            for (const procSel of proceedSelectors) {
              try {
                const procBtn = await page.locator(procSel).first();
                if (await procBtn.isVisible({ timeout: 500 }).catch(() => false)) {
                  logger.info(`Found proceed button: ${procSel}`);
                  await procBtn.click();
                  logger.success('Clicked proceed button!');
                  await page.waitForTimeout(2000);
                  break;
                }
              } catch (e) {}
            }
            
            break;
          }
        }
      } catch (e) {}
    }
    
    if (!clicked) {
      // Strategy 2: Use JavaScript to click the element
      logger.info('Trying JavaScript click approach...');
      const jsClicked = await page.evaluate(() => {
        const btns = document.querySelectorAll('button, [role="button"]');
        for (const btn of btns) {
          if (btn.innerText && btn.innerText.includes('Select')) {
            btn.click();
            return true;
          }
        }
        return false;
      });
      
      if (jsClicked) {
        logger.success('Clicked via JavaScript!');
        await page.waitForTimeout(2000);
        clicked = true;
      }
    }
    
    if (clicked) {
      await setQuantity(page, ticketAmount);
      return true;
    }
  } catch (e) {
    logger.debug(`Select button approach failed: ${e.message}`);
  }
  
  // First, try to find "Select" buttons directly (Loket's current structure)
  try {
    // Look for the Select dropdown/button
    const selectButtons = await page.$$('button:has-text("Select"), button:has-text("Pilih"), [class*="select"] button, .btn-select');
    
    if (selectButtons.length > 0) {
      logger.info(`Found ${selectButtons.length} Select button(s)`);
      
      // For each keyword, try to find matching category
      for (const keyword of categoryKeywords) {
        logger.info(`Searching for category: "${keyword}"`);
        
        // Get all ticket sections/rows
        const ticketSections = await page.$$('[class*="ticket"], [class*="category"], .card, .ticket-row, div:has(button:has-text("Select"))');
        
        for (const section of ticketSections) {
          const text = await section.textContent();
          
          if (text && text.toLowerCase().includes(keyword.toLowerCase())) {
            // Check if sold out
            if (text.toLowerCase().includes('sold out') || text.toLowerCase().includes('habis')) {
              logger.warn(`Category "${keyword}" is SOLD OUT, trying next...`);
              continue;
            }
            
            logger.success(`Found available category: "${keyword}"`);
            
            // Find the Select button in this section
            const selectBtn = await section.$('button:has-text("Select"), button:has-text("Pilih")');
            if (selectBtn) {
              await selectBtn.click();
              logger.success('Clicked Select button!');
              await page.waitForTimeout(1000);
              await setQuantity(page, ticketAmount);
              return true;
            }
          }
        }
      }
      
      // If keywords not matched, click first available Select button
      logger.warn('Keyword not matched, clicking first available Select button...');
      const firstSelect = selectButtons[0];
      if (firstSelect && await firstSelect.isVisible()) {
        await firstSelect.click();
        logger.success('Clicked first available Select button!');
        await page.waitForTimeout(1000);
        await setQuantity(page, ticketAmount);
        return true;
      }
    }
  } catch (e) {
    logger.debug(`Error with Select button approach: ${e.message}`);
  }
  
  // Fallback: Try all possible selectors
  logger.info('Trying fallback selectors...');
  
  const fallbackSelectors = [
    'button:has-text("Select")',
    'button:has-text("Pilih")',
    '.btn-primary:has-text("Select")',
    '[class*="select"]:not([disabled])',
    'button[class*="select"]',
    '.ticket-item button',
    '.card button'
  ];
  
  for (const selector of fallbackSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn && await btn.isVisible()) {
        await btn.click();
        logger.success(`Clicked button with selector: ${selector}`);
        await page.waitForTimeout(1000);
        await setQuantity(page, ticketAmount);
        return true;
      }
    } catch (e) {
      continue;
    }
  }
  
  logger.error('No available ticket categories found!');
  return false;
}

// Set ticket quantity
async function setQuantity(page, amount) {
  logger.info(`Setting quantity to ${amount}...`);
  
  try {
    // Try direct input first
    const quantityInput = await page.$('input[type="number"], .quantity-input, [class*="quantity"] input, input[name*="qty"]');
    if (quantityInput) {
      await quantityInput.fill('');
      await quantityInput.fill(String(amount));
      logger.success(`Quantity set to ${amount}`);
      return;
    }
    
    // Try plus button if input not found
    const plusButton = await page.$('.qty-plus, .btn-plus, [class*="plus"], button:has-text("+")');
    if (plusButton) {
      for (let i = 1; i < amount; i++) {
        await plusButton.click();
        await page.waitForTimeout(100);
      }
      logger.success(`Quantity set to ${amount} using plus button`);
      return;
    }
    
    logger.warn('Could not find quantity selector, proceeding with default quantity');
  } catch (e) {
    logger.warn(`Error setting quantity: ${e.message}`);
  }
}

// Fill personal data form
async function fillForm(page, personalData) {
  logger.info('Filling personal data form...');
  
  await page.waitForTimeout(2000); // Wait for form to load
  
  // Debug: List all visible input fields
  const allInputs = await page.$$('input:visible, textarea:visible');
  logger.info(`Found ${allInputs.length} visible input fields`);
  
  for (let i = 0; i < allInputs.length; i++) {
    try {
      const inp = allInputs[i];
      const name = await inp.getAttribute('name') || '';
      const type = await inp.getAttribute('type') || '';
      const placeholder = await inp.getAttribute('placeholder') || '';
      const id = await inp.getAttribute('id') || '';
      logger.info(`  Input ${i + 1}: name="${name}" type="${type}" placeholder="${placeholder}" id="${id}"`);
    } catch (e) {}
  }
  
  // Try to fill each field using multiple strategies
  const fieldMappings = [
    {
      name: 'Name',
      value: personalData.name,
      selectors: [
        'input[name="firstname"]',
        'input[name="name"]',
        'input[name="fullname"]',
        'input[name="full_name"]',
        'input[name*="nama"]',
        'input[placeholder*="Nama"]',
        'input[placeholder*="Name"]',
        'input[id*="name"]',
        'input[id*="nama"]'
      ]
    },
    {
      name: 'NIK',
      value: personalData.nik,
      selectors: [
        'input[name="identity_id"]',
        'input[name="nik"]',
        'input[name*="identity"]',
        'input[name*="nik"]',
        'input[name*="ktp"]',
        'input[placeholder*="NIK"]',
        'input[placeholder*="KTP"]',
        'input[placeholder*="Identitas"]',
        'input[id*="nik"]',
        'input[id*="identity"]'
      ]
    },
    {
      name: 'Email',
      value: personalData.email,
      selectors: [
        'input[name="email"]',
        'input[type="email"]',
        'input[id="email"]',
        'input[name*="email"]',
        'input[placeholder*="Email"]',
        'input[id*="email"]'
      ]
    },
    {
      name: 'Phone',
      value: personalData.phone,
      selectors: [
        'input[name="phone"]',
        'input[name="phoneNumber"]',
        'input[name*="phone"]',
        'input[type="tel"]'
      ]
    }
  ];
  
  for (const mapping of fieldMappings) {
    let filled = false;
    
    for (const selector of mapping.selectors) {
      try {
        const field = await page.locator(selector).first();
        if (await field.isVisible({ timeout: 500 }).catch(() => false)) {
          await field.fill(mapping.value);
          logger.success(`Filled ${mapping.name}: ${mapping.value.substring(0, 10)}...`);
          filled = true;
          break;
        }
      } catch (e) {}
    }
    
    if (!filled) {
      logger.warn(`Could not find field for: ${mapping.name}`);
    }
  }
  
  // Fill Phone by position - it's Input 3 (the one with empty name after email)
  try {
    // Get all visible text inputs
    const allTextInputs = await page.locator('input[type="text"]:visible').all();
    logger.info(`Found ${allTextInputs.length} visible text inputs for phone check`);
    
    // Phone field is typically the one without a name attribute
    for (let i = 0; i < allTextInputs.length; i++) {
      const inp = allTextInputs[i];
      const nameAttr = await inp.getAttribute('name');
      const currentValue = await inp.inputValue();
      
      // If this field has no name attribute and is empty
      if (!nameAttr && (!currentValue || currentValue === '')) {
        // Click to focus
        await inp.click();
        await page.waitForTimeout(100);
        
        // Clear any existing value first
        await inp.fill('');
        await page.waitForTimeout(50);
        
        // Use type() with delay to preserve leading zeros
        await inp.type(personalData.phone, { delay: 30 });
        await page.waitForTimeout(100);
        
        const newValue = await inp.inputValue();
        if (newValue === personalData.phone || newValue === personalData.phone.replace(/^0/, '')) {
          logger.success(`Filled Phone (input ${i+1}): ${newValue.substring(0, 8)}...`);
        } else {
          logger.warn(`Phone value after type: ${newValue}`);
        }
        break;
      }
    }
  } catch (e) {
    logger.warn(`Phone position fill error: ${e.message}`);
  }
  
  // Fill Domisili
  if (personalData.domisili) {
    try {
      const domisiliField = await page.locator('input[name*="domisili"]').first();
      if (await domisiliField.isVisible({ timeout: 500 }).catch(() => false)) {
        await domisiliField.fill(personalData.domisili);
        logger.success(`Filled Domisili: ${personalData.domisili}`);
      }
    } catch (e) {
      logger.warn('Could not find Domisili field');
    }
  }
  
  // Handle Gender (radio buttons)
  if (personalData.gender) {
    try {
      const genderValue = personalData.gender.toLowerCase();
      logger.info(`Looking for Gender field (${genderValue})...`);
      
      // First, list all visible radio buttons for debugging
      const allRadios = await page.locator('input[type="radio"]:visible').all();
      logger.info(`Found ${allRadios.length} visible radio buttons`);
      
      // Try to find and click the correct gender radio
      const genderSelectors = [
        `input[type="radio"][value="${genderValue}"]`,
        `input[type="radio"][value="${genderValue === 'male' ? 'L' : 'P'}"]`,
        `input[type="radio"][value="${genderValue === 'male' ? 'M' : 'F'}"]`,
        `input[type="radio"][value="${genderValue === 'male' ? 'laki-laki' : 'perempuan'}"]`,
        `input[type="radio"][value="${genderValue === 'male' ? 'pria' : 'wanita'}"]`,
        `label:has-text("${genderValue === 'male' ? 'Laki' : 'Perempuan'}")`,
        `label:has-text("${genderValue === 'male' ? 'Male' : 'Female'}")`,
        `label:has-text("${genderValue === 'male' ? 'Pria' : 'Wanita'}")`,
        `div:has-text("${genderValue === 'male' ? 'Laki' : 'Perempuan'}") input[type="radio"]`
      ];
      
      let genderSet = false;
      for (const sel of genderSelectors) {
        try {
          const radio = await page.locator(sel).first();
          if (await radio.isVisible({ timeout: 300 }).catch(() => false)) {
            await radio.click();
            logger.success(`Selected Gender: ${genderValue} using ${sel}`);
            genderSet = true;
            break;
          }
        } catch (e) {}
      }
      
      // If not found by selector, try clicking by position
      if (!genderSet && allRadios.length >= 2) {
        const idx = genderValue === 'male' ? 0 : 1;
        logger.info(`Trying gender by position: radio ${idx + 1} of ${allRadios.length}`);
        await allRadios[idx].click();
        logger.success(`Selected Gender by position: ${genderValue}`);
        genderSet = true;
      }
      
      if (!genderSet) {
        logger.warn('Could not set Gender - no visible radio buttons found');
      }
    } catch (e) {
      logger.warn(`Gender error: ${e.message}`);
    }
  }
  
  // Handle DOB (Date of Birth) - Uses a clickable div with calendar popover
  if (personalData.dob) {
    try {
      logger.info('Looking for DOB/Date of Birth field...');

      // Target DOB Data
      const [year, month, day] = personalData.dob.split('-');
      const targetYear = year;
      const targetDay = day;

      // Map month number to Indonesian month name
      const monthNamesIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                               'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const targetMonth = monthNamesIndo[parseInt(month) - 1];

      logger.info(`Target DOB: ${targetDay} ${targetMonth} ${targetYear}`);

      // 1. Click the "Select Date of Birth" trigger div
      const dobTrigger = page.locator('div:has-text("Select Date of Birth")');
      if (await dobTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
        logger.info('Clicking "Select Date of Birth" trigger...');
        await dobTrigger.last().click();
        await page.waitForTimeout(500);

        // 2. Wait for calendar popover to appear
        await page.waitForSelector('.datepicker-popover, [role="dialog"], .calendar, [class*="popover"]', { state: 'visible', timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);

        // 3. Click Year header to open year dropdown
        const yearHeader = page.locator('button, div').filter({ hasText: /^2008$|^2009$|^201[0-9]$|^202[0-9]$/ }).first();
        if (await yearHeader.isVisible({ timeout: 1000 }).catch(() => false)) {
          logger.info(`Clicking year header to select ${targetYear}...`);
          await yearHeader.click();
          await page.waitForTimeout(300);

          // Select target year from dropdown
          const yearOption = page.locator(`text="${targetYear}"`);
          if (await yearOption.isVisible({ timeout: 1000 }).catch(() => false)) {
            await yearOption.click();
            logger.info(`Selected year: ${targetYear}`);
            await page.waitForTimeout(300);
          }
        }

        // 4. Click Month header to open month dropdown
        const monthHeader = page.locator('button, div').filter({
          hasText: /Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember/
        }).first();
        if (await monthHeader.isVisible({ timeout: 1000 }).catch(() => false)) {
          logger.info(`Clicking month header to select ${targetMonth}...`);
          await monthHeader.click();
          await page.waitForTimeout(300);

          // Select target month from dropdown (Indonesian name)
          const monthOption = page.locator(`text="${targetMonth}"`);
          if (await monthOption.isVisible({ timeout: 1000 }).catch(() => false)) {
            await monthOption.click();
            logger.info(`Selected month: ${targetMonth}`);
            await page.waitForTimeout(300);
          }
        }

        // 5. Select the day from the grid
        const dayInGrid = page.locator('.calendar-day, [role="gridcell"], td, button').filter({
          hasText: new RegExp(`^${targetDay}$`)
        }).first();
        if (await dayInGrid.isVisible({ timeout: 1000 }).catch(() => false)) {
          logger.info(`Selecting day: ${targetDay}`);
          await dayInGrid.click();
          logger.success(`Successfully set DOB to ${targetDay} ${targetMonth} ${targetYear}`);
          await page.waitForTimeout(300);
        } else {
          // Try alternative day selector
          const dayButton = page.locator(`button:has-text("${targetDay}")`).first();
          if (await dayButton.isVisible({ timeout: 500 }).catch(() => false)) {
            await dayButton.click();
            logger.success(`Successfully set DOB to ${targetDay} ${targetMonth} ${targetYear}`);
          } else {
            logger.warn(`Could not find day ${targetDay} in calendar`);
          }
        }
      } else {
        logger.warn('Could not find "Select Date of Birth" trigger');
      }
    } catch (e) {
      logger.warn(`DOB fill error: ${e.message}`);
    }
  }
  
  // Check terms checkbox if exists
  try {
    const termsSelectors = [
      'input[type="checkbox"]',
      '[class*="terms"] input',
      'input[name*="agree"]'
    ];
    
    for (const sel of termsSelectors) {
      const checkbox = await page.locator(sel).first();
      if (await checkbox.isVisible({ timeout: 500 }).catch(() => false)) {
        const isChecked = await checkbox.isChecked();
        if (!isChecked) {
          await checkbox.check();
          logger.success('Accepted terms and conditions');
        }
        break;
      }
    }
  } catch (e) {}
  
  logger.success('Form filling complete!');
}

// Navigate through checkout to payment
async function navigateToPayment(page) {
  logger.info('Navigating to payment page...');
  
  let maxClicks = 5; // Prevent infinite loops
  let clickCount = 0;
  
  while (clickCount < maxClicks) {
    await page.waitForTimeout(1000);
    
    // Check if we've reached payment method selection
    const paymentMethods = await page.$('.payment-method, [class*="payment-option"], [class*="payment-method"]');
    if (paymentMethods) {
      logger.success('🎉 REACHED PAYMENT PAGE! Please select your payment method manually.');
      return true;
    }
    
    // Try clicking next/continue buttons
    let clicked = false;
    
    for (const selector of selectors.checkout.nextButton) {
      try {
        const button = await page.$(selector);
        if (button && await button.isVisible() && !await button.isDisabled()) {
          await button.click();
          logger.info('Clicked continue/next button');
          clicked = true;
          clickCount++;
          break;
        }
      } catch (e) {}
    }
    
    // Try pay buttons
    if (!clicked) {
      for (const selector of selectors.checkout.payButton) {
        try {
          const button = await page.$(selector);
          if (button && await button.isVisible() && !await button.isDisabled()) {
            await button.click();
            logger.info('Clicked pay button');
            clicked = true;
            clickCount++;
            break;
          }
        } catch (e) {}
      }
    }
    
    if (!clicked) {
      logger.warn('No clickable buttons found, checking if on payment page...');
      break;
    }
  }
  
  // Wait for payment page to fully load
  logger.info('Waiting for payment page to load...');
  await page.waitForTimeout(3000);
  
  // Check current URL and page content
  const currentUrl = page.url();
  logger.info(`Current URL: ${currentUrl}`);
  
  // Debug: List all visible text containing "Payment" or "Virtual"
  try {
    const paymentTexts = await page.locator('text=/Payment|Virtual|Account|BCA/i').all();
    logger.info(`Found ${paymentTexts.length} payment-related text elements`);
  } catch (e) {}
  
  // === SELECT VA BCA PAYMENT ===
  logger.info('Looking for payment method selection...');
  
  let vaClicked = false;
  let bcaClicked = false;
  
  try {
    // Step 1: Click on "Virtual Account" card/header to expand
    // The VA section is an accordion - need to click the entire row
    const vaSelectors = [
      // Target the clickable card/row containing Virtual Account
      'div:has(> div:has-text("Virtual Account"))',
      'div[class*="accordion"]:has-text("Virtual Account")',
      'div[class*="payment"]:has-text("Virtual Account")',
      'div[class*="card"]:has-text("Virtual Account")',
      // Click on the chevron/arrow icon
      'div:has-text("Virtual Account") svg',
      'div:has-text("Virtual Account") [class*="chevron"]',
      'div:has-text("Virtual Account") [class*="arrow"]',
      // Direct text as fallback
      'text="Virtual Account"'
    ];
    
    for (const sel of vaSelectors) {
      try {
        const vaOption = await page.locator(sel).first();
        if (await vaOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          logger.info(`Found VA element with: ${sel}`);
          
          // Get bounding box and click in center
          const box = await vaOption.boundingBox();
          if (box) {
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            logger.success('Clicked on Virtual Account header');
            vaClicked = true;
            await page.waitForTimeout(1500); // Wait for accordion to expand
            break;
          }
        }
      } catch (e) {}
    }
    
    if (!vaClicked) {
      // Try clicking directly on the text
      try {
        await page.click('text="Virtual Account"');
        logger.success('Clicked on Virtual Account text');
        vaClicked = true;
        await page.waitForTimeout(1500);
      } catch (e) {
        logger.warn('Could not find Virtual Account option');
      }
    }
    
    // Step 2: Click on BCA radio option (it shows as "Virtual Account BCA" in expanded list)
    const bcaSelectors = [
      // Target the specific radio option row with BCA text
      'text="Virtual Account BCA"',
      'div:has-text("Virtual Account BCA")',
      'span:has-text("Virtual Account BCA")',
      // Radio button near BCA
      'input[type="radio"] + *:has-text("BCA")',
      'label:has-text("Virtual Account BCA")',
      'label:has-text("BCA")',
      // The row/div containing BCA
      'div:has(img[alt*="BCA"])',
      'img[alt*="BCA"]',
      'img[src*="bca"]',
      'img[src*="BCA"]'
    ];
    
    for (const sel of bcaSelectors) {
      try {
        const bcaOption = await page.locator(sel).first();
        if (await bcaOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          logger.info(`Found BCA element with: ${sel}`);
          
          // Get bounding box and click
          const box = await bcaOption.boundingBox();
          if (box) {
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            logger.success('Clicked on Virtual Account BCA');
            bcaClicked = true;
            await page.waitForTimeout(1000);
            break;
          }
        }
      } catch (e) {}
    }
    
    if (!bcaClicked) {
      // Fallback: Try clicking the second radio button (BCA is usually second option)
      try {
        const radios = await page.locator('input[type="radio"]:visible').all();
        if (radios.length >= 2) {
          await radios[1].click(); // Second radio = BCA
          logger.success('Clicked BCA radio by position');
          bcaClicked = true;
        }
      } catch (e) {
        logger.warn('Could not find BCA option');
      }
    }
  } catch (e) {
    logger.warn(`Payment selection error: ${e.message}`);
  }
  
  // Wait for payment options to load
  await page.waitForTimeout(2000);
  
  // === STEP 3: CHECK ALL CHECKBOXES (Terms & Conditions) ===
  logger.info('Looking for checkboxes to check...');
  try {
    const checkboxes = await page.locator('input[type="checkbox"]:visible').all();
    logger.info(`Found ${checkboxes.length} visible checkboxes`);
    
    for (let i = 0; i < checkboxes.length; i++) {
      try {
        const isChecked = await checkboxes[i].isChecked();
        if (!isChecked) {
          await checkboxes[i].click();
          logger.success(`Checked checkbox ${i + 1}`);
          await page.waitForTimeout(200);
        }
      } catch (e) {}
    }
  } catch (e) {
    logger.warn(`Checkbox error: ${e.message}`);
  }
  
  await page.waitForTimeout(500);
  
  // === STEP 4: CLICK PAY NOW / BAYAR SEKARANG BUTTON ===
  logger.info('Looking for Pay Now button...');
  const payNowSelectors = [
    'button:has-text("Pay Now")',
    'button:has-text("Bayar Sekarang")',
    'button:has-text("Bayar")',
    'button:has-text("Process Payment")',
    'button:has-text("Confirm")',
    'button:has-text("Konfirmasi")',
    'button[type="submit"]:visible',
    'button.btn-primary:visible',
    'button[class*="pay"]:visible',
    'button[class*="submit"]:visible'
  ];
  
  let payNowClicked = false;
  for (const sel of payNowSelectors) {
    try {
      const payBtn = await page.locator(sel).first();
      if (await payBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        const isDisabled = await payBtn.isDisabled().catch(() => false);
        if (!isDisabled) {
          logger.info(`Found Pay button: ${sel}`);
          await payBtn.click();
          logger.success('Clicked Pay Now button!');
          payNowClicked = true;
          await page.waitForTimeout(3000); // Wait for payment processing
          break;
        }
      }
    } catch (e) {}
  }
  
  if (!payNowClicked) {
    logger.warn('Could not find Pay Now button - may need to check checkboxes first');
  }
  
  // === STEP 5: EXTRACT VA NUMBER ===
  logger.info('Waiting for VA number to appear...');
  await page.waitForTimeout(3000);
  
  // Known tracking IDs to filter out (Facebook Pixel, Google Analytics, etc.)
  const TRACKING_IDS = [
    '835386638306873',  // Facebook Pixel ID for Loket
    '1234567890123456', // Example tracking ID
  ];
  
  // Function to check if a number is likely a tracking ID
  const isTrackingId = (num) => {
    if (TRACKING_IDS.includes(num)) return true;
    // Facebook Pixel IDs are typically 15-16 digits
    // VA BCA numbers are typically 12-16 digits but have specific patterns
    return false;
  };
  
  // Function to validate if number looks like a VA
  const isLikelyVA = (num) => {
    // Filter out phone numbers
    if (num.startsWith('62') || num.startsWith('08') || num.startsWith('021')) return false;
    // Filter out known tracking IDs
    if (isTrackingId(num)) return false;
    // VA BCA typically starts with specific prefixes
    // Common BCA VA prefixes: 39, 70, 88, etc. followed by merchant code
    return true;
  };
  
  let vaNumber = null;
  try {
    // ONLY look at visible text elements, NOT HTML source code
    // This avoids picking up tracking IDs from script tags
    
    // Step 1: Look for elements specifically labeled as VA number
    const vaLabelSelectors = [
      // Elements that contain "Virtual Account" or "VA" label
      'div:has-text("Virtual Account") >> xpath=following-sibling::*[1]',
      'span:has-text("Virtual Account") >> xpath=following-sibling::*[1]',
      'label:has-text("Virtual Account") >> xpath=following-sibling::*[1]',
      'p:has-text("Nomor VA")',
      'div:has-text("Nomor VA")',
      'span:has-text("No. Virtual Account")',
      // Copy button containers often have the VA number
      '[class*="copy"]:visible',
      'button:has-text("Copy"):visible',
      // Specific payment confirmation elements
      '[class*="payment-detail"]:visible',
      '[class*="account-number"]:visible',
      '[class*="va-number"]:visible'
    ];
    
    for (const sel of vaLabelSelectors) {
      try {
        const el = await page.locator(sel).first();
        if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
          const text = await el.textContent();
          // Look for 10-16 digit numbers in this element
          const matches = text.match(/\b(\d{10,16})\b/g);
          if (matches) {
            for (const num of matches) {
              if (isLikelyVA(num)) {
                logger.info(`Found potential VA from label: ${num}`);
                vaNumber = num;
                break;
              }
            }
          }
          if (vaNumber) break;
        }
      } catch (e) {}
    }
    
    // Step 2: Look for VA in specific visible containers (not script/meta tags)
    if (!vaNumber) {
      logger.info('Looking for VA in visible containers...');
      
      // Get all visible text containers that might have VA
      const visibleContainers = await page.locator(
        'main:visible, article:visible, section:visible, [role="main"]:visible, .content:visible'
      ).all();
      
      for (const container of visibleContainers) {
        try {
          const text = await container.textContent();
          // Must contain payment-related keywords
          if (text.toLowerCase().includes('virtual account') || 
              text.toLowerCase().includes('va ') ||
              text.toLowerCase().includes('bca') ||
              text.toLowerCase().includes('pembayaran')) {
            
            const matches = text.match(/\b(\d{12,16})\b/g);
            if (matches) {
              for (const num of matches) {
                if (isLikelyVA(num)) {
                  logger.info(`Found potential VA from container: ${num}`);
                  vaNumber = num;
                  break;
                }
              }
            }
          }
          if (vaNumber) break;
        } catch (e) {}
      }
    }
    
    // Step 3: Last resort - look in body text but with strict filtering
    if (!vaNumber) {
      logger.info('Searching in body text with strict filtering...');
      
      // Use JavaScript to get ONLY visible text (not script content)
      const visibleText = await page.evaluate(() => {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: function(node) {
              // Skip script, style, and hidden elements
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              const tagName = parent.tagName.toLowerCase();
              if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
                return NodeFilter.FILTER_REJECT;
              }
              const style = window.getComputedStyle(parent);
              if (style.display === 'none' || style.visibility === 'hidden') {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );
        
        let text = '';
        let node;
        while (node = walker.nextNode()) {
          text += node.textContent + ' ';
        }
        return text;
      });
      
      // Look for numbers near VA-related keywords
      const vaContextPattern = /(?:virtual\s*account|va\s*bca|nomor\s*va|no\.?\s*va|rekening)[:\s]*(\d{10,16})/gi;
      const contextMatches = visibleText.match(vaContextPattern);
      if (contextMatches) {
        for (const match of contextMatches) {
          const numMatch = match.match(/(\d{10,16})/);
          if (numMatch && isLikelyVA(numMatch[1])) {
            vaNumber = numMatch[1];
            logger.info(`Found VA near keyword: ${vaNumber}`);
            break;
          }
        }
      }
    }
    
  } catch (e) {
    logger.warn(`VA extraction error: ${e.message}`);
  }
  
  // === FINAL RESULT ===
  if (vaNumber) {
    logger.success('='.repeat(60));
    logger.success('🎉🎉🎉 PAYMENT READY! 🎉🎉🎉');
    logger.success(`💳 VA BCA NUMBER: ${vaNumber}`);
    logger.success('='.repeat(60));
    
    // Also save VA number to a file for easy access
    const fs = require('fs');
    const resultFile = path.join(__dirname, 'last_va_number.txt');
    const resultContent = `VA BCA: ${vaNumber}\nTime: ${new Date().toISOString()}\nEvent: ${page.url()}`;
    fs.writeFileSync(resultFile, resultContent);
    logger.info(`VA number saved to: ${resultFile}`);
  } else if (vaClicked && bcaClicked) {
    logger.success('🎉 VA BCA selected! Check browser for VA number.');
    logger.info('Bot could not auto-extract VA. Please check the browser window.');
  } else {
    logger.warn('⚠️ Payment flow may not be complete. Please check browser.');
  }
  
  return true;
}

// Main bot function
async function main() {
  logger.banner();
  
  // Load config and session
  const config = loadConfig();
  const session = loadSession();
  
  logger.info(`Target URL: ${config.targetUrl}`);
  logger.info(`Looking for categories: ${config.categoryKeywords.join(', ')}`);
  logger.info(`Ticket amount: ${config.ticketAmount}`);
  
  let browser;
  
  try {
    // Launch browser with stealth and loaded session
    logger.info('Launching browser with stealth mode...');
    
    browser = await chromium.launch({
      headless: config.settings.headless || false,
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
      storageState: session,
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'id-ID',
      timezoneId: 'Asia/Jakarta'
    });
    
    let page = await context.newPage();
    
    // Listen for popup/new window
    let popupPage = null;
    context.on('page', async (newPage) => {
      logger.success('New popup/window detected!');
      popupPage = newPage;
    });
    
    // Set default timeout
    page.setDefaultTimeout(config.settings.timeout || 30000);
    
    // Navigate to target event
    logger.info('Navigating to target event...');
    await page.goto(config.targetUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: config.settings.timeout || 30000 
    });
    
    // Check if waiting room
    if (isWaitingRoom(page.url())) {
      logger.queue('Entered waiting room immediately - waiting patiently...');
    }
    
    // Wait for buy button (high-speed polling)
    const buyButton = await waitForBuyButton(page, config.settings.pollIntervalMs || 100);
    
    // Click the buy button
    logger.war('CLICKING BUY BUTTON!');
    await buyButton.click();
    
    // Wait for ticket selection page/modal to load
    logger.info('Waiting for ticket selection page to load...');
    await page.waitForTimeout(3000);
    
    // Check if popup was opened
    if (popupPage) {
      logger.success('Switching to popup window...');
      page = popupPage;
      await page.waitForTimeout(2000);
      logger.info(`Popup URL: ${page.url()}`);
    }
    
    // Check for iframes that might contain the ticket widget
    const frames = page.frames();
    logger.info(`Found ${frames.length} frames on page`);
    
    for (const frame of frames) {
      try {
        const frameUrl = frame.url();
        if (frameUrl.includes('widget') || frameUrl.includes('loket')) {
          logger.info(`Checking frame: ${frameUrl}`);
          const selectInFrame = await frame.$('text=Select');
          if (selectInFrame) {
            logger.success('Found Select button in iframe!');
            await selectInFrame.click();
            await page.waitForTimeout(1000);
            // Continue with form filling in this frame
            break;
          }
        }
      } catch (e) {}
    }
    
    // Check if URL changed or if we need to navigate directly
    const urlAfterClick = page.url();
    logger.info(`URL after click: ${urlAfterClick}`);
    
    // If still on event page, try direct widget URL
    if (urlAfterClick.includes('/event/')) {
      logger.info('Still on event page, trying direct widget URL...');
      
      // Extract event slug from URL
      const eventSlug = config.targetUrl.split('/event/')[1]?.replace(/\/$/, '');
      if (eventSlug) {
        // Try common Loket widget URL patterns
        const widgetUrls = [
          `https://www.loket.com/widget/event/${eventSlug}`,
          `https://widget.loket.com/widget/${eventSlug}`,
          `https://www.loket.com/purchase/${eventSlug}`
        ];
        
        for (const widgetUrl of widgetUrls) {
          logger.info(`Trying: ${widgetUrl}`);
          try {
            await page.goto(widgetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
            await page.waitForTimeout(2000);
            
            // Check if we can find Select button now
            const selectBtn = await page.$('button:has-text("Select"), button:has-text("Pilih"), text=Select');
            if (selectBtn) {
              logger.success(`Found ticket page at: ${widgetUrl}`);
              break;
            }
          } catch (e) {
            logger.debug(`Widget URL failed: ${e.message}`);
          }
        }
      }
    }
    
    // Check if a modal/popup appeared - look for any Select button and scroll to it
    try {
      // Wait for Select button to exist (even if not visible yet)
      const selectLocator = page.locator('text=Select').first();
      await selectLocator.waitFor({ state: 'attached', timeout: 10000 });
      logger.success('Found Select element in DOM!');
      
      // Scroll to make it visible
      await selectLocator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      
      // Now check if visible and click
      if (await selectLocator.isVisible()) {
        logger.success('Ticket selection page/modal loaded!');
      }
    } catch (e) {
      logger.info(`Continuing to search for categories... (${e.message})`);
    }
    
    // Select category
    const categorySelected = await selectCategory(page, config.categoryKeywords, config.ticketAmount);
    if (!categorySelected) {
      logger.error('Failed to select any category. Please try manually.');
      // Keep browser open for manual intervention
      await page.waitForTimeout(300000); // 5 minutes
      await browser.close();
      return;
    }
    
    // Look for and click the continue/checkout button after category selection
    await page.waitForTimeout(1000);
    for (const selector of selectors.checkout.nextButton) {
      try {
        const btn = await page.$(selector);
        if (btn && await btn.isVisible()) {
          await btn.click();
          logger.success('Clicked checkout/continue button');
          break;
        }
      } catch (e) {}
    }
    
    // Fill form
    await page.waitForTimeout(2000);
    await fillForm(page, config.personalData);
    
    // Navigate to payment
    await navigateToPayment(page);
    
    // Keep browser open for verification
    logger.success('='.repeat(50));
    logger.success('BOT COMPLETED! Check above for VA number.');
    if (config.settings.headless) {
      logger.success('Headless mode - closing in 30 seconds.');
      await page.waitForTimeout(30000);
    } else {
      logger.success('Browser will stay open for 5 minutes for verification.');
      await page.waitForTimeout(300000); // 5 minutes
    }
    
    await browser.close();
    
  } catch (error) {
    logger.error(`Bot error: ${error.message}`);
    logger.error('Keeping browser open for manual intervention...');
    
    // Keep browser open on error
    if (browser) {
      await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes
      await browser.close();
    }
  }
}

// Run
main().catch(console.error);
