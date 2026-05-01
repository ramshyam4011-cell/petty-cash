/**
 * handleSettingRequests: Manages User Settings CRUD operations for the 'setting' sheet.
 * Columns: A:user, B:user name, C:password, D:role, E:branch, F:department, G:Page access
 */
function handleSettingRequests(payload) {
  const sheetName = 'setting';
  const ss = SpreadsheetApp.getActive();

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // Initialize with 7 columns including Page access
    sheet.appendRow(['user', 'user name', 'password', 'role', 'branch', 'department', 'Page access']);
    sheet.getRange("A1:G1").setFontWeight("bold").setBackground("#f1f5f9");
    sheet.setFrozenRows(1);
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
      const pageAccess = (d['Page access'] || '').trim(); // New field

      if (!userFull || !userName || !password) {
        return { success: false, error: 'All fields are required' };
      }

      // Duplicate check on 'user name'
      const values = sheet.getDataRange().getValues();
      const duplicate = values.slice(1).some(row => String(row[1]).trim() === userName);
      if (duplicate) {
        return { success: false, error: 'Username already exists' };
      }

      // Append 7 columns
      sheet.appendRow([userFull, userName, password, role, branch, dept, pageAccess]);
      return { success: true, message: 'User created successfully' };
    }

    // ---------- UPDATE ----------
    if (action === 'updateSetting') {
      const { oldValue, newValue } = payload.data;
      const oldUserName = (oldValue['user name'] || '').trim();
      if (!oldUserName) return { success: false, error: 'Missing old username' };

      const values = sheet.getDataRange().getValues();
      let updated = false;
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][1]).trim() === oldUserName) {
          // Update all 7 columns
          sheet.getRange(i + 1, 1, 1, 7).setValues([[
            newValue['user'] || values[i][0],
            newValue['user name'] || values[i][1],
            newValue['password'] || values[i][2],
            newValue['role'] || values[i][3],
            newValue['branch'] || values[i][4],
            newValue['department'] || values[i][5],
            newValue['Page access'] !== undefined ? newValue['Page access'] : values[i][6]
          ]]);
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
