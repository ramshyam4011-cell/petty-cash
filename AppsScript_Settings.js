/**
 * handleSettingRequests: Manages User Settings CRUD operations for the 'setting' sheet.
 * Columns: A:user, B:user name, C:password, D:role, E:branch, F:department, G:Page access, H:Reported by, I:Group Heads
 */
function handleSettingRequests(payload) {
  const sheetName = 'setting';
  const ss = SpreadsheetApp.getActive();

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['user', 'user name', 'password', 'role', 'branch', 'department', 'Page access', 'Reported by', 'Group Heads']);
    sheet.getRange("A1:I1").setFontWeight("bold").setBackground("#f1f5f9");
    sheet.setFrozenRows(1);
  } else {
    // Migrate: ensure 'Group Heads' column exists
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    if (!headers.includes('Group Heads')) {
      sheet.getRange(1, lastCol + 1).setValue('Group Heads').setFontWeight("bold").setBackground("#f1f5f9");
    }
  }

  const action = payload.action;

  try {
    // ---------- READ ----------
    if (action === 'readSetting') {
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(String);
      const rows = data.slice(1);
      const jsonData = rows.map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
        return obj;
      });
      return { success: true, data: jsonData };
    }

    // ---------- CREATE ----------
    if (action === 'createSetting') {
      const d = payload.data;
      const userName = (d['user name'] || '').trim();
      const userFull = (d['user'] || '').trim();
      const password = (d['password'] || '').trim();
      const role = (d['role'] || 'USER').toUpperCase();
      const branch = (d['branch'] || 'Head Office').trim();
      const dept = (d['department'] || 'Accounts').trim();
      const pageAccess = (d['Page access'] || '').trim();
      const reportedBy = (d['Reported by'] || '').trim();
      const groupHeads = (d['Group Heads'] || '').trim();

      if (!userFull || !userName || !password) {
        return { success: false, error: 'All fields are required' };
      }

      const values = sheet.getDataRange().getValues();
      const duplicate = values.slice(1).some(row => String(row[1]).trim() === userName);
      if (duplicate) {
        return { success: false, error: 'Username already exists' };
      }

      sheet.appendRow([userFull, userName, password, role, branch, dept, pageAccess, reportedBy, groupHeads]);
      return { success: true, message: 'User created successfully' };
    }

    // ---------- UPDATE ----------
    if (action === 'updateSetting') {
      const { oldValue, newValue } = payload.data;
      const oldUserName = (oldValue['user name'] || '').trim();
      if (!oldUserName) return { success: false, error: 'Missing old username' };

      const allData = sheet.getDataRange().getValues();
      const headers = allData[0].map(String);
      const values = allData.slice(1);

      // Build column index map
      const colIdx = {};
      headers.forEach((h, i) => { colIdx[h] = i; });

      let updated = false;
      for (let i = 0; i < values.length; i++) {
        if (String(values[i][colIdx['user name'] ?? 1]).trim() === oldUserName) {
          const rowNum = i + 2; // 1-indexed + header row
          const numCols = headers.length;
          const rowValues = values[i].slice();

          // Update each field if present in newValue
          const fieldMap = {
            'user': 'user',
            'user name': 'user name',
            'password': 'password',
            'role': 'role',
            'branch': 'branch',
            'department': 'department',
            'Page access': 'Page access',
            'Reported by': 'Reported by',
            'Group Heads': 'Group Heads'
          };

          Object.keys(fieldMap).forEach(field => {
            if (newValue[field] !== undefined && colIdx[field] !== undefined) {
              rowValues[colIdx[field]] = newValue[field];
            }
          });

          sheet.getRange(rowNum, 1, 1, numCols).setValues([rowValues]);
          updated = true;
          break;
        }
      }
      return updated
        ? { success: true, message: 'User updated' }
        : { success: false, error: 'User not found' };
    }

    // ---------- DELETE ----------
    if (action === 'deleteSetting') {
      const userName = (payload.data['user name'] || '').trim();
      if (!userName) return { success: false, error: 'Username required' };

      const values = sheet.getDataRange().getValues();
      for (let i = values.length - 1; i >= 1; i--) {
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
