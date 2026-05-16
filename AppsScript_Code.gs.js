/**
 * CRUD API for Add_Expense & PettyCash sheets with Approval & Delete functionality,
 * PLUS Master data management.
 *
 * Add_Expense sheet: Reads headers from Row 1 dynamically (supports any column layout)
 * PettyCash sheet:   A (Timestamp), B (Date), C (Type), D (Amount), E (Description), F-J (Docs)
 * Master sheet:      Group Head, Expense Head, Sub Head
 * Setting sheet:     user, user name, password, role, branch, department, Page access
 */

const SHEET_NAME = 'Add_Expense';
const PETTY_CASH_SHEET = 'PettyCash';
const BILL_FOLDER_ID = '117ZrN-VJ93qyYQpH649bVGdVi89at62e';
const SPREADSHEET_ID = '1zObgd-x7nlclhtFhWjBoeoHhaNYA-pShwikVWkFlPuY';

// Auto-initialize Add_Expense headers if needed
function initAddExpenseHeaders() {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (sheet.getLastColumn() === 0) {
    sheet.appendRow(['Timestamp', 'SN', 'Date', 'Payment mode', 'Group Head', 'Expense Head', 'Sub Head', 'Amount (INR)', 'Paid To', 'Branch', 'Description / Reason', 'user', 'Bill / Receipt', 'Approval Timestamp', 'Status', 'Approval / Reject - Remark', 'Delete Status', 'Flow', 'Reported by']);
    sheet.getRange(1, 1, 1, 19).setFontWeight('bold').setBackground('#f1f5f9');
  } else {
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.indexOf('Reported by') === -1) {
      sheet.getRange(1, headers.length + 1).setValue('Reported by').setFontWeight('bold').setBackground('#f1f5f9');
    }
  }
}

// ==================== ENTRY POINTS ====================

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({ success: true, message: 'Add_Expense & PettyCash API running. Use POST.' })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    initAddExpenseHeaders();

    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('No POST data received.');
    }

    var request = JSON.parse(e.postData.contents);
    var action = request.action;
    if (!action) throw new Error('Missing "action" parameter.');

    var actionLower = String(action).toLowerCase();

    // ---- MASTER SHEET ACTIONS ----
    if (
      actionLower === 'readmaster' ||
      actionLower === 'createmaster' ||
      actionLower === 'updatemaster' ||
      actionLower === 'deletemaster'
    ) {
      var result = handleMasterRequests(request);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ---- SETTING SHEET ACTIONS ----
    if (
      actionLower === 'readsetting' ||
      actionLower === 'createsetting' ||
      actionLower === 'updatesetting' ||
      actionLower === 'deletesetting'
    ) {
      var result = handleSettingRequests(request);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var result;

    switch (actionLower) {
      // ---- Add_Expense CRUD ----
      case 'create':
        result = handleCreate(getSheet(), request.data);
        break;
      case 'read':
        result = handleRead(getSheet(), request.filter);
        break;
      case 'update':
        result = handleUpdate(getSheet(), request);
        break;
      case 'delete':
        result = handleDelete(getSheet(), request);
        break;
      case 'batchcreate':
        result = handleBatchCreate(getSheet(), request.data);
        break;
      case 'batchupdate':
        result = handleBatchUpdate(getSheet(), request);
        break;
      case 'archive':
        result = handleArchive(getSheet(), request.date);
        break;

      // ---- File Upload ----
      case 'uploadfile':
        return ContentService.createTextOutput(JSON.stringify(handleUploadFile(request)))
          .setMimeType(ContentService.MimeType.JSON);

      // ---- PettyCash CRUD ----
      case 'readpettycash':
        result = handleReadPettyCash();
        break;
      case 'createpettycash':
        result = handleCreatePettyCash(request.data);
        break;
      case 'deletepettycash':
        result = handleDeletePettyCash(request.timestamp);
        break;

      default:
        throw new Error('Invalid action: ' + action);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message || error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}


// ==================== HELPERS ====================

function getSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found.');
  return sheet;
}

function getHeaders(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
}

function getAllData(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length === 0) return { headers: [], rows: [] };
  var headers = values[0].map(String);
  var rows = values.slice(1);
  return { headers: headers, rows: rows };
}

function rowToObject(row, headers) {
  var obj = {};
  headers.forEach(function(h, i) { obj[h] = row[i] !== undefined ? row[i] : ''; });
  return obj;
}

function matchesFilter(row, headers, filter) {
  for (var key in filter) {
    var idx = headers.indexOf(key);
    if (idx === -1 || String(row[idx]) !== String(filter[key])) return false;
  }
  return true;
}

function generateSerialNumber(sheet, timestamp) {
  var year = timestamp.getFullYear();
  var prefix = 'VCH-' + year + '-';
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return prefix + '001';

  var headers = values[0].map(String);
  var snIndex = headers.indexOf('SN');
  var maxSeq = 0;

  for (var i = 1; i < values.length; i++) {
    var sn = String(values[i][snIndex] || '');
    var match = sn.match(/^VCH-(\d{4})-(\d{3})$/);
    if (match && match[1] === String(year)) {
      var seq = parseInt(match[2], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  return prefix + (maxSeq + 1).toString().padStart(3, '0');
}


// ==================== ADD_EXPENSE CRUD ====================

/**
 * CREATE — Reads actual headers from Row 1, maps payload by column name.
 * Automatically handles Timestamp, SN, Amount, user, Status, Delete Status, Flow.
 * Works regardless of column order or count.
 */
function handleCreate(sheet, data) {
  var headers = getHeaders(sheet).map(function(h) { return h.trim(); });
  if (headers.length === 0) throw new Error('Sheet has no headers in Row 1.');

  var timestamp = new Date();
  var sn = generateSerialNumber(sheet, timestamp);

  // Pre-process data keys for flexible matching
  var dataMap = {};
  for (var key in data) {
    dataMap[String(key).toLowerCase().replace(/\s+/g, '')] = data[key];
  }

  var newRow = headers.map(function(col) {
    var cleanCol = col.trim();
    var lowerCol = cleanCol.toLowerCase().replace(/\s+/g, '');

    switch (cleanCol) {
      case 'Timestamp': return timestamp;
      case 'SN': return sn;
      case 'Amount (INR)': return parseFloat(data['Amount (INR)'] || dataMap['amount(inr)']) || 0;
      case 'user':
        var userField = data.user || dataMap['user'];
        if (userField && typeof userField === 'object') return userField.name || 'Admin';
        return userField || 'Admin';
      default:
        // Try exact match first, then fuzzy match
        if (data[cleanCol] !== undefined) return data[cleanCol];
        if (dataMap[lowerCol] !== undefined) return dataMap[lowerCol];
        return '';
    }
  });

  sheet.appendRow(newRow);
  return rowToObject(newRow, headers);
}

/**
 * READ — Returns all rows (or filtered) as JSON objects using actual sheet headers.
 */
function handleRead(sheet, filter) {
  var allData = getAllData(sheet);
  var rows = allData.rows;
  if (filter && Object.keys(filter).length > 0) {
    rows = rows.filter(function(row) { return matchesFilter(row, allData.headers, filter); });
  }
  return rows.map(function(row) { return rowToObject(row, allData.headers); });
}

/**
 * UPDATE — Finds row by SN, updates Status, Approval Timestamp, Remark, Delete Status.
 * Uses header names to find correct column indexes (no hardcoded column numbers).
 */
function handleUpdate(sheet, request) {
  var sn = request.sn;
  if (!sn) throw new Error('Missing SN for update.');

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var snIndex = headers.indexOf('SN');
  if (snIndex === -1) throw new Error('SN column not found in sheet.');

  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][snIndex]) === String(sn)) {
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex === -1) throw new Error('Record with SN "' + sn + '" not found.');

  // Update matching columns based on action type
  headers.forEach(function(header, idx) {
    var colNum = idx + 1;
    
    // PRIMARY APPROVAL (Columns N-Q, roughly index 14-17)
    if (colNum >= 14 && colNum <= 17) {
      if (header === 'Approval Timestamp' && request.timestamp && !request.isDeleteAction) {
        sheet.getRange(rowIndex, colNum).setValue(request.timestamp);
      } else if (header === 'Status' && request.status && !request.isDeleteAction) {
        sheet.getRange(rowIndex, colNum).setValue(request.status);
      } else if (header === 'Approval / Reject - Remark' && request.remark && !request.isDeleteAction) {
        sheet.getRange(rowIndex, colNum).setValue(request.remark);
      }
    }

    // DELETION APPROVAL (Columns S-V, roughly index 19-22)
    if (colNum >= 19 && colNum <= 22) {
      if (header === 'Planned1' && request.deletePlanned) {
        sheet.getRange(rowIndex, colNum).setValue(request.deletePlanned);
      } else if (header === 'Approval1 Timestamp' && request.timestamp && request.isDeleteAction) {
        sheet.getRange(rowIndex, colNum).setValue(request.timestamp);
      } else if (header === 'Status1' && request.isDeleteAction) {
        var s1Value = (request.deleteStatus === 'PENDING_DELETE') ? 'PENDING' : (request.status || 'DELETED');
        sheet.getRange(rowIndex, colNum).setValue(s1Value);
      } else if (header === 'Approval / Reject - Remark1' && request.remark && request.isDeleteAction) {
        sheet.getRange(rowIndex, colNum).setValue(request.remark);
      }
    }

    // ALWAYS UPDATE DELETE STATUS
    if (header === 'Delete Status') {
      sheet.getRange(rowIndex, colNum).setValue(request.deleteStatus || 'ACTIVE');
    }

    // DELETED BY (Column X, index 24)
    if (colNum === 24 && request.deletedBy) {
      sheet.getRange(rowIndex, colNum).setValue(request.deletedBy);
    }
  });

  return { sn: sn, status: request.status || '', updated: true };
}

/**
 * DELETE — Removes the entire row by SN.
 */
function handleDelete(sheet, request) {
  var sn = request.sn;
  if (!sn) throw new Error('Missing SN for delete operation.');

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var snIndex = headers.indexOf('SN');
  if (snIndex === -1) throw new Error('SN column not found in sheet.');

  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][snIndex]) === String(sn)) {
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex === -1) throw new Error('Record with SN "' + sn + '" not found.');

  sheet.deleteRow(rowIndex);
  return { sn: sn, deleted: true };
}


// ==================== FILE UPLOAD ====================

/**
 * Uploads a base64-encoded file to Google Drive.
 */
function handleUploadFile(payload) {
  try {
    var folderId = payload.folderId || BILL_FOLDER_ID;
    var folder = DriveApp.getFolderById(folderId);
    var base64 = payload.file.replace(/^data:.+;base64,/, '');
    var blob = Utilities.newBlob(Utilities.base64Decode(base64), payload.mimeType, payload.fileName || 'file');
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return {
      success: true,
      data: { url: file.getUrl(), id: file.getId() }
    };
  } catch (err) {
    return { success: false, error: 'Drive Access Error: ' + err.toString() };
  }
}

/**
 * Helper: uploads base64 file to a specific folder. Used by PettyCash attachments.
 */
function uploadBase64File(base64, mimeType, fileName, folderId) {
  var folder = DriveApp.getFolderById(folderId);
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fileName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { url: file.getUrl(), id: file.getId() };
}


// ==================== PETTYCASH CRUD ====================

function getPettyCashSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(PETTY_CASH_SHEET);
  if (!sheet) throw new Error('Sheet "' + PETTY_CASH_SHEET + '" not found.');
  return sheet;
}

function handleReadPettyCash() {
  var sheet = getPettyCashSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];

  var headers = data[0].map(function(h) { return String(h).trim(); });
  var rows = data.slice(1);

  return rows.map(function(row) {
    var obj = {};
    headers.forEach(function(header, i) {
      obj[header] = row[i] !== undefined ? String(row[i]).trim() : '';
    });
    return obj;
  });
}

function handleCreatePettyCash(data) {
  if (!data || !data.Date || !data.Type || data.Amount == null) {
    throw new Error('Missing required fields: Date, Type, Amount');
  }

  var sheet = getPettyCashSheet();
  var timestamp = Utilities.formatDate(new Date(), 'GMT+5:30', 'M/d/yyyy HH:mm:ss');

  var folderId = data.FolderId || '1U7iXD3-_v3dKn-gyv5M3eG3HxV01mTmR';
  var attachments = Array.isArray(data.Attachments) ? data.Attachments : [];
  var docUrls = ['', '', '', '', ''];

  attachments.slice(0, 5).forEach(function(att, idx) {
    try {
      var base64 = att.data.replace(/^data:.+;base64,/, '');
      var uploaded = uploadBase64File(base64, att.type, att.name, folderId);
      docUrls[idx] = uploaded.url;
    } catch (err) {
      console.error('Failed to upload attachment ' + (idx + 1) + ': ' + err);
    }
  });

  var newRow = [
    timestamp,
    data.Date,
    data.Type,
    parseFloat(data.Amount) || 0,
    data.Description || '',
    docUrls[0], docUrls[1], docUrls[2], docUrls[3], docUrls[4]
  ];

  sheet.appendRow(newRow);
  return { created: true, timestamp: timestamp };
}

function handleDeletePettyCash(timestamp) {
  if (!timestamp) throw new Error('Missing Timestamp for delete operation.');

  var sheet = getPettyCashSheet();
  var data = sheet.getDataRange().getValues();
  var tz = Session.getScriptTimeZone();
  var format = 'M/d/yyyy HH:mm:ss';

  var targetFormatted;
  try {
    targetFormatted = Utilities.formatDate(new Date(timestamp), tz, format);
  } catch (e) {
    targetFormatted = String(timestamp).trim();
  }

  for (var i = 1; i < data.length; i++) {
    var rowValue = data[i][0];
    var rowFormatted;

    if (rowValue instanceof Date) {
      rowFormatted = Utilities.formatDate(rowValue, tz, format);
    } else {
      rowFormatted = String(rowValue).trim();
    }

    if (rowFormatted === targetFormatted) {
      sheet.deleteRow(i + 1);
      return { success: true, deleted: true, timestamp: timestamp };
    }
  }

  throw new Error('Transaction not found. (Looking for: ' + targetFormatted + ')');
}


// ==================== MASTER SHEET CRUD ====================

function handleMasterRequests(payload) {
  var sheetName = 'Master';
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['Group Head', 'Expense Head', 'Sub Head', 'Vendore', 'Branch']);
    sheet.getRange('A1:E1').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var action = payload.action;

  try {
    // ---- READ ----
    if (action === 'readMaster') {
      var dataRange = sheet.getDataRange();
      var values = dataRange.getValues();
      if (values.length <= 1) return { success: true, data: [] };

      var headers = values[0];
      var rows = values.slice(1);
      var jsonData = rows.map(function(row) {
        var obj = {};
        headers.forEach(function(header, index) { obj[header] = row[index] || ''; });
        return obj;
      });
      return { success: true, data: jsonData };
    }

    // ---- CREATE ----
    if (action === 'createMaster') {
      var data = payload.data;
      var vendor = data['Vendore'] || '';
      var branch = data['Branch'] || '';

      if (vendor) {
        return createInColumn(sheet, 4, vendor);
      } else if (branch) {
        return createInColumn(sheet, 5, branch);
      } else {
        // Hierarchy (Group/Exp/Sub) - Find first row where A-C are empty starting from row 2
        var groupHead = (data['Group Head'] || '').trim();
        var expenseHead = (data['Expense Head'] || '').trim();
        var subHead = (data['Sub Head'] || '').trim();
        
        var values = sheet.getDataRange().getValues();
        // Duplicate check
        for (var i = 1; i < values.length; i++) {
          if (String(values[i][0]).trim() === groupHead && 
              String(values[i][1]).trim() === expenseHead && 
              String(values[i][2]).trim() === subHead) {
            return { success: true, message: 'Already exists' };
          }
        }

        // Find first empty row in A-C
        var targetRow = values.length + 1;
        for (var i = 1; i < values.length; i++) {
          if (String(values[i][0]).trim() === '' && 
              String(values[i][1]).trim() === '' && 
              String(values[i][2]).trim() === '') {
            targetRow = i + 1;
            break;
          }
        }
        sheet.getRange(targetRow, 1, 1, 3).setValues([[groupHead, expenseHead, subHead]]);
        return { success: true, message: 'Hierarchy added' };
      }
    }

    // ---- UPDATE ----
    if (action === 'updateMaster') {
      var d = payload.data;
      var level = d.level;
      var oldValue = d.oldValue || {};
      var newValue = d.newValue || {};

      var values = sheet.getDataRange().getValues();
      var updatedCount = 0;

      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        var match = false;

        if (level === 'vendor') {
          if (String(row[3]).trim() === String(oldValue['Vendore'] || '').trim()) {
            sheet.getRange(i + 1, 4).setValue(newValue['Vendore'] || '');
            updatedCount++;
          }
        } else if (level === 'branch') {
          if (String(row[4]).trim() === String(oldValue['Branch'] || '').trim()) {
            sheet.getRange(i + 1, 5).setValue(newValue['Branch'] || '');
            updatedCount++;
          }
        } else {
          // Hierarchy matching logic
          var rowGroup   = String(row[0]).trim();
          var rowExpense = String(row[1]).trim();
          var rowSub     = String(row[2]).trim();
          
          var oldGroup   = String(oldValue['Group Head']   || oldValue['Group Heads']   || '').trim();
          var oldExpense = String(oldValue['Expense Head'] || oldValue['Expense Heads'] || '').trim();
          var oldSub     = String(oldValue['Sub Head']     || oldValue['Sub Heads']     || '').trim();

          var matchesParent = true;
          if (oldGroup && rowGroup !== oldGroup) matchesParent = false;
          if (oldExpense && rowExpense !== oldExpense) matchesParent = false;

          if (matchesParent) {
            if (level === 'group' && rowGroup === oldGroup) {
              sheet.getRange(i + 1, 1).setValue(newValue['Group Head'] || newValue['Group Heads'] || row[0]);
              updatedCount++;
            } else if (level === 'expense' && rowExpense === oldExpense) {
              sheet.getRange(i + 1, 2).setValue(newValue['Expense Head'] || newValue['Expense Heads'] || row[1]);
              updatedCount++;
            } else if (level === 'sub' && rowSub === oldSub) {
              sheet.getRange(i + 1, 3).setValue(newValue['Sub Head'] || newValue['Sub Heads'] || row[2]);
              updatedCount++;
            }
          }
        }
      }
      return { success: true, message: 'Updated ' + updatedCount + ' items' };
    }

    // ---- DELETE ----
    if (action === 'deleteMaster') {
      var data = payload.data;
      var targetVendor = data['Vendore'];
      var targetBranch = data['Branch'];

      if (targetVendor !== undefined) {
        return deleteFromColumn(sheet, 4, targetVendor);
      } else if (targetBranch !== undefined) {
        return deleteFromColumn(sheet, 5, targetBranch);
      } else {
        // Hierarchy Delete
        var tGroup   = String(data['Group Head'] || '').trim();
        var tExpense = String(data['Expense Head'] || '').trim();
        var tSub     = String(data['Sub Head'] || '').trim();
        
        var values = sheet.getDataRange().getValues();
        var deletedCount = 0;

        for (var i = values.length - 1; i >= 1; i--) {
          var row = values[i];
          var sGroup   = String(row[0]).trim();
          var sExpense = String(row[1]).trim();
          var sSub     = String(row[2]).trim();
          var shouldDelete = false;
          var isMatch = true;
          if (tGroup && sGroup !== tGroup) isMatch = false;
          if (tExpense && sExpense !== tExpense) isMatch = false;
          if (tSub && sSub !== tSub) isMatch = false;
          
          if (isMatch && (tGroup || tExpense || tSub)) {
            shouldDelete = true;
          }

          if (shouldDelete) {
            // Only delete row if D and E are empty, otherwise just clear A-C to preserve independent lists
            if (String(row[3] || '').trim() === '' && String(row[4] || '').trim() === '') {
              sheet.deleteRow(i + 1);
            } else {
              sheet.getRange(i + 1, 1, 1, 3).clearContent();
            }
            deletedCount++;
          }
        }
        return { success: true, deleted: true, count: deletedCount };
      }
    }

    return { success: false, error: 'Unknown action for Master' };

  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Helper: Append value to the first empty cell in a specific column
function createInColumn(sheet, colIndex, value) {
  var values = sheet.getRange(1, colIndex, sheet.getLastRow() + 10, 1).getValues();
  var valToMatch = String(value).trim();
  
  // Duplicate check in specific column
  for (var j = 1; j < values.length; j++) {
    if (String(values[j][0]).trim() === valToMatch) return { success: true, message: 'Already exists' };
  }

  // Find first empty cell
  var targetRow = values.length + 1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === '') {
      targetRow = i + 1;
      break;
    }
  }
  sheet.getRange(targetRow, colIndex).setValue(value);
  return { success: true, message: 'Added' };
}

// Helper: Delete specific value from column and shift UP
function deleteFromColumn(sheet, colIndex, value) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, deleted: false };
  var values = sheet.getRange(1, colIndex, lastRow, 1).getValues();
  var valToMatch = String(value).trim();
  var found = false;

  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]).trim() === valToMatch) {
      sheet.getRange(i + 1, colIndex).deleteCells(SpreadsheetApp.Dimension.ROWS);
      found = true;
    }
  }
  return { success: true, deleted: found };
}

// ==================== SETTING SHEET CRUD ====================

/**
 * Manages User Settings CRUD for the 'setting' sheet.
 * Columns: A:user, B:user name, C:password, D:role, E:branch, F:department, G:Page access, H:Reported by, I:Group Heads
 */
function handleSettingRequests(payload) {
  var sheetName = 'setting';
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['user', 'user name', 'password', 'role', 'branch', 'department', 'Page access', 'Reported by', 'Group Heads']);
    sheet.getRange('A1:I1').setFontWeight('bold').setBackground('#f1f5f9');
    sheet.setFrozenRows(1);
  } else {
    // Migrate: ensure 'Group Heads' column exists
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    if (headers.indexOf('Group Heads') === -1) {
      sheet.getRange(1, lastCol + 1).setValue('Group Heads').setFontWeight('bold').setBackground('#f1f5f9');
    }
  }

  var action = payload.action;

  try {
    // ---- READ ----
    if (action === 'readSetting') {
      var data = sheet.getDataRange().getValues();
      var headers = data[0].map(String);
      var rows = data.slice(1);
      var jsonData = rows.map(function(row) {
        var obj = {};
        headers.forEach(function(h, i) { obj[h] = row[i] !== undefined ? row[i] : ''; });
        return obj;
      });
      return { success: true, data: jsonData };
    }

    // ---- CREATE ----
    if (action === 'createSetting') {
      var d = payload.data;
      var userName = (d['user name'] || '').trim();
      var userFull = (d['user'] || '').trim();
      var password = (d['password'] || '').trim();
      var role = (d['role'] || 'USER').toUpperCase();
      var branch = (d['branch'] || 'Head Office').trim();
      var dept = (d['department'] || 'Accounts').trim();
      var pageAccess = (d['Page access'] || '').trim();
      var reportedBy = (d['Reported by'] || '').trim();
      var groupHeads = (d['Group Heads'] || '').trim();

      if (!userFull || !userName || !password) {
        return { success: false, error: 'All fields are required' };
      }

      var values = sheet.getDataRange().getValues();
      var duplicate = values.slice(1).some(function(row) {
        return String(row[1]).trim() === userName;
      });
      if (duplicate) {
        return { success: false, error: 'Username already exists' };
      }

      sheet.appendRow([userFull, userName, password, role, branch, dept, pageAccess, reportedBy, groupHeads]);
      return { success: true, message: 'User created successfully' };
    }

    // ---- UPDATE ----
    if (action === 'updateSetting') {
      var d = payload.data;
      var oldValue = d.oldValue;
      var newValue = d.newValue;
      var oldUserName = (oldValue['user name'] || '').trim();
      if (!oldUserName) return { success: false, error: 'Missing old username' };

      var allData = sheet.getDataRange().getValues();
      var hdrs = allData[0].map(String);
      var colMap = {};
      hdrs.forEach(function(h, i) { colMap[h] = i; });
      var numCols = hdrs.length;
      var updated = false;

      for (var i = 1; i < allData.length; i++) {
        if (String(allData[i][colMap['user name'] !== undefined ? colMap['user name'] : 1]).trim() === oldUserName) {
          var row = allData[i].slice();
          var fieldMap = {
            'user': 'user', 'user name': 'user name', 'password': 'password',
            'role': 'role', 'branch': 'branch', 'department': 'department',
            'Page access': 'Page access', 'Reported by': 'Reported by', 'Group Heads': 'Group Heads'
          };
          Object.keys(fieldMap).forEach(function(field) {
            if (newValue[field] !== undefined && colMap[field] !== undefined) {
              row[colMap[field]] = newValue[field];
            }
          });
          sheet.getRange(i + 1, 1, 1, numCols).setValues([row]);
          updated = true;
          break;
        }
      }
      return updated
        ? { success: true, message: 'User updated' }
        : { success: false, error: 'User not found' };
    }

    // ---- DELETE ----
    if (action === 'deleteSetting') {
      var userName = (payload.data['user name'] || '').trim();
      if (!userName) return { success: false, error: 'Username required' };

      var values = sheet.getDataRange().getValues();
      for (var i = values.length - 1; i >= 1; i--) {
        if (String(values[i][1]).trim() === userName) {
          sheet.deleteRow(i + 1);
          return { success: true, message: 'User deleted' };
        }
      }
      return { success: false, error: 'User not found' };
    }

    return { success: false, error: 'Unknown setting action' };

  } catch (err) {
    return { success: false, error: err.toString() };
  }
}


// ==================== TEST FUNCTIONS ====================

function testRead() {
  var result = handleMasterRequests({ action: 'readMaster' });
  Logger.log(JSON.stringify(result));
}

function testDrive() {
  Logger.log(DriveApp.getFolderById(BILL_FOLDER_ID).getName());
}

function testReadExpenses() {
  var sheet = getSheet();
  var headers = getHeaders(sheet);
  Logger.log('Add_Expense headers: ' + headers.join(', '));
  var result = handleRead(sheet);
  Logger.log('Total rows: ' + result.length);
  if (result.length > 0) Logger.log('First row: ' + JSON.stringify(result[0], null, 2));
}

function testReadPettyCash() {
  var sheet = getPettyCashSheet();
  var dataRange = sheet.getDataRange();

  if (dataRange.getLastRow() < 1) {
    Logger.log('Sheet is empty.');
    return;
  }

  var headers = dataRange.getValues()[0].map(String).map(function(h) { return h.trim(); });
  Logger.log('Headers: ' + headers.join(', '));

  var result = handleReadPettyCash();
  Logger.log('Total rows: ' + result.length);

  if (result.length > 0) {
    Logger.log('First row: ' + JSON.stringify(result[0], null, 2));
  }
  Logger.log('Read test completed.');
}
function handleBatchCreate(sheet, dataArray) {
  if (!dataArray || !Array.isArray(dataArray)) throw new Error('Invalid data for batch create');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rowsToAdd = dataArray.map(function(item) {
    return headers.map(function(h) {
      return item[h] !== undefined ? item[h] : '';
    });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, headers.length).setValues(rowsToAdd);
  return { success: true, count: rowsToAdd.length };
}

function handleBatchUpdate(sheet, request) {
  var sns = request.sns;
  if (!sns || !Array.isArray(sns)) throw new Error('Missing SNS for batch update.');

  var range = sheet.getDataRange();
  var data = range.getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var snIndex = headers.indexOf('SN');
  if (snIndex === -1) throw new Error('SN column not found in sheet.');

  var snToUpdate = {};
  sns.forEach(function(sn) { snToUpdate[String(sn)] = true; });

  var updatedCount = 0;
  for (var i = 1; i < data.length; i++) {
    var sn = String(data[i][snIndex]);
    if (snToUpdate[sn]) {
      headers.forEach(function(header, idx) {
        var colNum = idx + 1;
        
        // PRIMARY APPROVAL
        if (colNum >= 14 && colNum <= 17) {
          if (header === 'Approval Timestamp' && request.timestamp && !request.isDeleteAction) {
            data[i][idx] = request.timestamp;
          } else if (header === 'Status' && request.status && !request.isDeleteAction) {
            data[i][idx] = request.status;
          } else if (header === 'Approval / Reject - Remark' && request.remark && !request.isDeleteAction) {
            data[i][idx] = request.remark;
          }
        }

        // DELETION APPROVAL
        if (colNum >= 19 && colNum <= 22) {
          if (header === 'Approval1 Timestamp' && request.timestamp && request.isDeleteAction) {
            data[i][idx] = request.timestamp;
          } else if (header === 'Status1' && request.isDeleteAction) {
            var s1Value = (request.deleteStatus === 'PENDING_DELETE') ? 'PENDING' : (request.status || 'DELETED');
            data[i][idx] = s1Value;
          } else if (header === 'Approval / Reject - Remark1' && request.remark && request.isDeleteAction) {
            data[i][idx] = request.remark;
          }
        }

        // ALWAYS UPDATE DELETE STATUS
        if (header === 'Delete Status') {
          data[i][idx] = request.deleteStatus || 'ACTIVE';
        }
      });
      updatedCount++;
    }
  }

  range.setValues(data);
  return { success: true, count: updatedCount };
}

function handleArchive(sheet, archiveDate) {
  if (!archiveDate) throw new Error('Archive date is required.');
  
  var targetDate = new Date(archiveDate);
  targetDate.setHours(0, 0, 0, 0);

  var range = sheet.getDataRange();
  var data = range.getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  
  var dateIdx = headers.indexOf('Date');
  var flowIdx = headers.indexOf('Flow');
  var amountIdx = headers.indexOf('Amount (INR)');
  var statusIdx = headers.indexOf('Status');
  var deleteStatusIdx = headers.indexOf('Delete Status');

  if (dateIdx === -1 || flowIdx === -1 || amountIdx === -1) {
    throw new Error('Required columns (Date, Flow, Amount) not found.');
  }

  var inflowSum = 0;
  var outflowSum = 0;
  var rowsToDelete = [];

  for (var i = 1; i < data.length; i++) {
    var rowValue = data[i][dateIdx];
    var rowDate = rowValue instanceof Date ? rowValue : new Date(rowValue);
    if (isNaN(rowDate.getTime())) continue;
    
    var compareDate = new Date(rowDate);
    compareDate.setHours(0, 0, 0, 0);

    if (compareDate < targetDate) {
      var isDeleted = String(data[i][deleteStatusIdx]) === 'DELETED';
      var isApproved = String(data[i][statusIdx]) === 'APPROVED';
      var isFlowIn = String(data[i][flowIdx]) === 'IN';

      if (!isDeleted && (isApproved || isFlowIn)) {
        var amount = parseFloat(data[i][amountIdx]) || 0;
        if (isFlowIn) inflowSum += amount;
        else outflowSum += amount;
      }
      rowsToDelete.push(i + 1);
    }
  }

  if (rowsToDelete.length === 0) {
    return { success: true, message: 'No entries found before ' + archiveDate, count: 0 };
  }

  var openingBalance = inflowSum - outflowSum;

  for (var k = rowsToDelete.length - 1; k >= 0; k--) {
    sheet.deleteRow(rowsToDelete[k]);
  }

  var timestamp = new Date();
  var sn = generateSerialNumber(sheet, timestamp);
  
  var newRow = headers.map(function(col) {
    switch (col) {
      case 'Timestamp': return timestamp;
      case 'SN': return sn;
      case 'Date': return archiveDate;
      case 'Group Head': return 'OPENING BALANCE';
      case 'Expense Head': return 'ARCHIVED SUMMARY';
      case 'Amount (INR)': return Math.abs(openingBalance);
      case 'Flow': return openingBalance >= 0 ? 'IN' : 'OUT';
      case 'Description / Reason': return 'Consolidated balance from archived data before ' + archiveDate;
      case 'user': return 'System';
      case 'Status': return 'APPROVED';
      case 'Delete Status': return 'ACTIVE';
      case 'Branch': return 'Head Office';
      default: return '';
    }
  });

  sheet.appendRow(newRow);

  return { 
    success: true, 
    message: 'Archived ' + rowsToDelete.length + ' entries.',
    details: 'Opening Balance: ' + openingBalance,
    deletedCount: rowsToDelete.length                
  };
}
