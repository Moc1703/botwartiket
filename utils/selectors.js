/**
 * Centralized DOM selectors for Loket.com
 * Update these if Loket changes their website structure
 */
const selectors = {
  // ===== Login Page =====
  login: {
    emailInput: 'input[name="email"], input[type="email"]',
    passwordInput: 'input[name="password"], input[type="password"]',
    loginButton: 'button[type="submit"], .btn-login',
    userAvatar: '.user-avatar, .profile-avatar, [class*="avatar"]',
    userMenu: '.user-menu, .dropdown-user, [class*="user-dropdown"]'
  },

  // ===== Event Page =====
  event: {
    // Main buy button
    buyButton: [
      'button:has-text("Beli Tiket")',
      'a:has-text("Beli Tiket")',
      '[class*="buy"]:has-text("Beli")',
      '.btn-buy-ticket',
      'button:has-text("Buy Ticket")',
      '[data-action="buy-ticket"]'
    ],
    
    // Ticket categories container
    categoryContainer: '.ticket-category, .ticket-list, [class*="ticket-type"]',
    
    // Individual category items
    categoryItem: '.ticket-item, .ticket-category-item, [class*="ticket-row"]',
    
    // Category name text
    categoryName: '.ticket-name, .category-name, [class*="ticket-title"]',
    
    // Category price
    categoryPrice: '.ticket-price, .price, [class*="price"]',
    
    // Sold out indicator
    soldOut: [
      ':has-text("Sold Out")',
      ':has-text("Habis")',
      ':has-text("Tidak Tersedia")',
      '.sold-out',
      '[class*="sold-out"]',
      '.disabled'
    ],
    
    // Quantity selector
    quantityInput: 'input[type="number"], .quantity-input, [class*="quantity"] input',
    quantityPlus: '.qty-plus, .btn-plus, [class*="plus"]',
    quantityMinus: '.qty-minus, .btn-minus, [class*="minus"]',
    
    // Select/Choose button for category
    selectButton: [
      'button:has-text("Pilih")',
      'button:has-text("Select")',
      '.btn-select',
      '[class*="select-ticket"]'
    ]
  },

  // ===== Waiting Room / Queue =====
  waitingRoom: {
    // URL patterns that indicate waiting room
    urlPatterns: ['waiting-room', 'queue', 'antrean', 'antrian'],
    
    // Queue position indicator
    queuePosition: '.queue-position, .position, [class*="position"]',
    
    // Estimated time
    estimatedTime: '.estimated-time, .eta, [class*="waiting-time"]',
    
    // Progress indicator
    progress: '.queue-progress, .progress, [class*="progress"]'
  },

  // ===== Checkout / Form =====
  checkout: {
    // Personal data form fields
    form: {
      nik: [
        'input[name="nik"]',
        'input[name*="nik"]',
        'input[placeholder*="NIK"]',
        'input[placeholder*="KTP"]',
        '[class*="nik"] input'
      ],
      name: [
        'input[name="name"]',
        'input[name="fullname"]',
        'input[name*="nama"]',
        'input[placeholder*="Nama"]',
        'input[placeholder*="Name"]',
        '[class*="name"] input:not([type="email"])'
      ],
      email: [
        'input[name="email"]',
        'input[type="email"]',
        'input[placeholder*="Email"]',
        '[class*="email"] input'
      ],
      phone: [
        'input[name="phone"]',
        'input[name="handphone"]',
        'input[name*="telepon"]',
        'input[name*="hp"]',
        'input[type="tel"]',
        'input[placeholder*="Telepon"]',
        'input[placeholder*="Phone"]',
        'input[placeholder*="HP"]',
        '[class*="phone"] input'
      ]
    },
    
    // Continue/Next buttons
    nextButton: [
      'button:has-text("Lanjutkan")',
      'button:has-text("Selanjutnya")',
      'button:has-text("Next")',
      'button:has-text("Continue")',
      '.btn-next',
      '.btn-continue',
      '[class*="next"]',
      'button[type="submit"]'
    ],
    
    // Pay now button
    payButton: [
      'button:has-text("Bayar")',
      'button:has-text("Bayar Sekarang")',
      'button:has-text("Pay")',
      'button:has-text("Pay Now")',
      '.btn-pay',
      '[class*="pay"]'
    ],
    
    // Terms checkbox
    termsCheckbox: 'input[type="checkbox"][name*="term"], input[type="checkbox"][name*="agree"]',
    
    // Error messages
    errorMessage: '.error-message, .alert-danger, [class*="error"]'
  },

  // ===== Payment Page =====
  payment: {
    // Payment method options
    methodList: '.payment-method-list, .payment-options, [class*="payment-method"]',
    methodItem: '.payment-method-item, .payment-option, [class*="method-item"]',
    
    // Confirm payment
    confirmButton: [
      'button:has-text("Konfirmasi")',
      'button:has-text("Confirm")',
      '.btn-confirm'
    ]
  }
};

/**
 * Helper function to try multiple selectors
 * Returns the first one that matches
 */
async function findElement(page, selectorArray, options = {}) {
  const { timeout = 5000, state = 'visible' } = options;
  
  // If it's a string, convert to array
  const selectors = Array.isArray(selectorArray) ? selectorArray : [selectorArray];
  
  for (const selector of selectors) {
    try {
      const element = await page.waitForSelector(selector, { 
        timeout: timeout / selectors.length, 
        state 
      });
      if (element) return element;
    } catch (e) {
      // Continue to next selector
    }
  }
  
  return null;
}

/**
 * Check if any selector exists (doesn't wait)
 */
async function elementExists(page, selectorArray) {
  const selectors = Array.isArray(selectorArray) ? selectorArray : [selectorArray];
  
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) return true;
    } catch (e) {
      // Continue to next selector
    }
  }
  
  return false;
}

module.exports = {
  selectors,
  findElement,
  elementExists
};
