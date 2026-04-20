// Storage Manager - Handle all localStorage operations

const STORAGE_KEYS = {
  USERS: 'pcb_users',
  CREDITS: 'pcb_credits',
  EXPENSES: 'pcb_expenses',
  LEDGER: 'pcb_ledger',
  SETTINGS: 'pcb_settings',
  AUTH_USER: 'pcb_authUser'
};

// Initialize default data
const DEFAULT_USERS = [
  { id: 'admin', name: 'Admin User', password: 'admin123', role: 'ADMIN', accessPages: [] },
  { id: 'user', name: 'Employee 1', password: 'user123', role: 'USER', accessPages: [] },
  { id: 'user2', name: 'Employee 2', password: 'user123', role: 'USER', accessPages: [] }
];

const DEFAULT_SETTINGS = {
  groupHeads: ['IT', 'HR', 'Finance', 'Operations', 'Marketing'],
  paymentModes: ['Cash', 'Cheque', 'Bank Transfer', 'Online Payment'],
  lastSerialNumber: 0
};

const DEFAULT_CREDITS = [];
const DEFAULT_EXPENSES = [];
const DEFAULT_LEDGER = [];

// Initialize storage with defaults
export const initializeStorage = () => {
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.CREDITS)) {
    localStorage.setItem(STORAGE_KEYS.CREDITS, JSON.stringify(DEFAULT_CREDITS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.EXPENSES)) {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(DEFAULT_EXPENSES));
  }
  if (!localStorage.getItem(STORAGE_KEYS.LEDGER)) {
    localStorage.setItem(STORAGE_KEYS.LEDGER, JSON.stringify(DEFAULT_LEDGER));
  }
};

// Get data from storage
export const getFromStorage = (key) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

// Save data to storage
export const saveToStorage = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// User operations
export const getUsers = () => {
  const users = getFromStorage(STORAGE_KEYS.USERS);
  if (!users || !users.some(u => u.id === 'admin')) {
    saveToStorage(STORAGE_KEYS.USERS, DEFAULT_USERS);
    return DEFAULT_USERS;
  }
  return users;
};
export const saveUsers = (users) => saveToStorage(STORAGE_KEYS.USERS, users);

// Credits operations
export const getCredits = () => {
  const credits = getFromStorage(STORAGE_KEYS.CREDITS) || [];

  // Seed dummy data if needed (less than 50 rows)
  if (credits.length < 50) {
    const recordsToCreate = 50 - credits.length;
    let currentSnCount = credits.length > 0 ? parseInt(credits[credits.length - 1].sn.split('-')[1]) || 1000 : 1000;
    const dummyCredits = [...credits];
    const dummyLedger = getFromStorage(STORAGE_KEYS.LEDGER) || [];

    // Seed backwards based on today's date
    const baseDate = new Date();

    for (let i = 0; i < recordsToCreate; i++) {
      currentSnCount++;
      const pName = ['John Doe', 'Jane Smith', 'Acme Corp', 'Admin User', 'Employee 1'][(i % 5)];
      const mode = ['Cash', 'Cheque', 'Bank Transfer', 'Online'][(i % 4)];

      const dateObj = new Date(baseDate.getTime() - ((recordsToCreate - i) * 86400000));
      const dateStr = dateObj.toISOString().split('T')[0];

      const creditId = `CRD-${Date.now()}-${currentSnCount}`;
      const amount = (Math.floor(Math.random() * 50) + 1) * 100; // 100 to 5000

      const newCredit = {
        id: creditId,
        sn: `SN-${currentSnCount}`,
        personName: pName,
        date: dateStr,
        amount: amount,
        paymentMode: mode,
        image: '',
        remarks: `Dummy seed record ${i + 1}`,
        status: 'APPROVED',
        timestamp: dateObj.toISOString()
      };

      dummyCredits.push(newCredit);

      // Calculate current active balance for this person
      let currentBalance = 0;
      dummyLedger.filter(l => l.personName === pName).forEach(l => {
        if (l.type === 'CREDIT') currentBalance += l.amount;
        if (l.type === 'DEBIT') currentBalance -= l.amount;
      });
      currentBalance += amount;

      dummyLedger.push({
        id: `LDG-${Date.now()}-${currentSnCount}`,
        personName: pName,
        type: 'CREDIT',
        amount: amount,
        date: dateStr,
        referenceId: creditId,
        balance: currentBalance,
        timestamp: dateObj.toISOString()
      });
    }

    saveToStorage(STORAGE_KEYS.CREDITS, dummyCredits);
    saveToStorage(STORAGE_KEYS.LEDGER, dummyLedger);

    // Attempt to quickly refresh the page silently to grab the new changes
    if (typeof window !== 'undefined' && dummyCredits.length >= 50 && credits.length < 50) {
      setTimeout(() => window.location.reload(), 200);
    }
    return dummyCredits;
  }

  return credits;
};
export const saveCredits = (credits) => saveToStorage(STORAGE_KEYS.CREDITS, credits);
export const saveCredit = (credit) => {
  const credits = getCredits();
  credits.push(credit);
  saveCredits(credits);
};
export const getCreditById = (id) => {
  const credits = getCredits();
  return credits.find(c => c.id === id);
};
export const updateCredit = (updated) => {
  const credits = getCredits();
  const index = credits.findIndex(c => c.id === updated.id);
  if (index !== -1) {
    credits[index] = updated;
    saveCredits(credits);
  }
};

// Expenses operations
export const getExpenses = () => {
  const expenses = getFromStorage(STORAGE_KEYS.EXPENSES) || [];

  // Seed dummy data if needed (less than 25 rows)
  if (expenses.length < 25) {
    const recordsToCreate = 25 - expenses.length;
    let currentSnCount = expenses.length > 0 ? parseInt(expenses[expenses.length - 1].sn.split('-')[1]) || 2000 : 2000;
    const dummyExpenses = [...expenses];
    const dummyLedger = getFromStorage(STORAGE_KEYS.LEDGER) || [];

    // Seed backwards based on today's date
    const baseDate = new Date();

    for (let i = 0; i < recordsToCreate; i++) {
      currentSnCount++;
      const pName = ['John Doe', 'Jane Smith', 'Acme Corp', 'Admin User', 'Employee 1'][(i % 5)];
      const mode = ['Cash', 'Cheque', 'Bank Transfer', 'Online'][(i % 4)];
      const group = ['IT', 'HR', 'Finance', 'Operations', 'Marketing'][(i % 5)];
      // Mix of statuses
      const status = i % 5 === 0 ? 'REJECTED' : (i % 2 === 0 ? 'APPROVED' : 'PENDING');

      const dateObj = new Date(baseDate.getTime() - ((recordsToCreate - i) * 86400000));
      const dateStr = dateObj.toISOString().split('T')[0];

      const expenseId = `EXP-${Date.now()}-${currentSnCount}`;
      const amount = (Math.floor(Math.random() * 15) + 1) * 100; // 100 to 1500

      const newExpense = {
        id: expenseId,
        sn: `EXP-${currentSnCount}`,
        personName: pName,
        date: dateStr,
        amount: amount,
        paymentMode: mode,
        groupHead: group,
        image: '',
        remarks: `Dummy expense record ${i + 1}`,
        status: status,
        timestamp: dateObj.toISOString()
      };

      dummyExpenses.push(newExpense);

      // Calculate current active balance for this person if APPROVED
      if (status === 'APPROVED') {
        let currentBalance = 0;
        dummyLedger.filter(l => l.personName === pName).forEach(l => {
          if (l.type === 'CREDIT') currentBalance += l.amount;
          if (l.type === 'EXPENSE') currentBalance -= l.amount;
          if (l.type === 'DEBIT') currentBalance -= l.amount; // Just in case
        });
        currentBalance -= amount;

        dummyLedger.push({
          id: `LDG-${Date.now()}-${currentSnCount}`,
          personName: pName,
          type: 'EXPENSE', // Used in standard ledger additions
          amount: amount,
          date: dateStr,
          referenceId: expenseId,
          balance: currentBalance,
          timestamp: dateObj.toISOString()
        });
      }
    }

    saveToStorage(STORAGE_KEYS.EXPENSES, dummyExpenses);
    saveToStorage(STORAGE_KEYS.LEDGER, dummyLedger);

    // Attempt to quickly refresh the page silently to grab the new changes
    if (typeof window !== 'undefined' && dummyExpenses.length >= 25 && expenses.length < 25) {
      setTimeout(() => window.location.reload(), 200);
    }
    return dummyExpenses;
  }

  return expenses;
};
export const saveExpenses = (expenses) => saveToStorage(STORAGE_KEYS.EXPENSES, expenses);
export const saveExpense = (expense) => {
  const expenses = getExpenses();
  expenses.push(expense);
  saveExpenses(expenses);
};
export const getExpenseById = (id) => {
  const expenses = getExpenses();
  return expenses.find(e => e.id === id);
};
export const updateExpense = (updated) => {
  const expenses = getExpenses();
  const index = expenses.findIndex(e => e.id === updated.id);
  if (index !== -1) {
    expenses[index] = updated;
    saveExpenses(expenses);
  }
};

// Ledger operations
export const getLedger = () => getFromStorage(STORAGE_KEYS.LEDGER) || [];
export const saveLedgers = (ledger) => saveToStorage(STORAGE_KEYS.LEDGER, ledger);
export const saveLedger = (entry) => {
  const ledger = getLedger();
  ledger.push(entry);
  saveLedgers(ledger);
};

// Settings operations
export const getSettings = () => getFromStorage(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;
export const saveSettings = (settings) => saveToStorage(STORAGE_KEYS.SETTINGS, settings);

// Auth operations
export const getAuthUser = () => getFromStorage(STORAGE_KEYS.AUTH_USER);
export const saveAuthUser = (user) => saveToStorage(STORAGE_KEYS.AUTH_USER, user);
export const clearAuthUser = () => localStorage.removeItem(STORAGE_KEYS.AUTH_USER);

// Export keys
export { STORAGE_KEYS };
