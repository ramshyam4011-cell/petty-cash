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
  return getFromStorage(STORAGE_KEYS.CREDITS) || [];
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
  return getFromStorage(STORAGE_KEYS.EXPENSES) || [];
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
