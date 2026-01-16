
import Papa from 'papaparse';
import { User, UserRole, LeaveRequest } from '../types';

/**
 * MASTER DATA SOURCE:
 * Updated to the new published URL provided by the user.
 * Format: Published CSV for programmatic access.
 */
const PUB_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT4Q6pUrcEplhMoFkj_iiLhscwLf4FDyqYChp0ZWPDQI9zkZ4660cRZjJw6E_Mcf6mI-_lXY4iwPDwV/pub?output=csv';

// URL for Apps Script live logging (if applicable)
const APPS_SCRIPT_URL = ''; 

export const fetchUsersFromSheet = async (): Promise<User[]> => {
  try {
    const response = await fetch(PUB_URL, {
      method: 'GET',
      cache: 'no-store',
      mode: 'cors'
    });
    
    if (!response.ok) {
      throw new Error(`Cloud Access Restricted (HTTP ${response.status}). Ensure the sheet is "Published to the web" as a CSV.`);
    }
    
    const csvData = await response.text();
    
    // Check if the response is actually HTML (happens if not published correctly)
    if (csvData.trim().startsWith('<!DOCTYPE html>') || csvData.includes('google-signin')) {
      throw new Error('Access Denied: The spreadsheet is not "Published to the web" correctly. In Google Sheets, go to File > Share > Publish to web, select "Comma-separated values (.csv)", and click Publish.');
    }

    return new Promise((resolve, reject) => {
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (!results.data || results.data.length === 0) {
            resolve([]);
            return;
          }

          const users: User[] = results.data
            .map((row: any, index: number) => {
              const getField = (keys: string[]) => {
                const foundKey = Object.keys(row).find(k => 
                  keys.some(search => k.toLowerCase().trim() === search.toLowerCase())
                );
                return foundKey ? String(row[foundKey]).trim() : null;
              };

              const name = getField(['Employee Name', 'Name', 'Full Name', 'Staff Name']);
              const rawRole = getField(['Role', 'Designation', 'Position', 'Rank', 'UserRole']) || 'Reliever';
              const id = getField(['ID', 'Employee ID', 'Staff ID', 'S/N']) || `uid-${index}`;
              const username = getField(['Username', 'User', 'Login ID', 'Email']) || '';
              const password = getField(['Password', 'Pass', 'PWD', 'Security Key']) || '';

              if (!name) return null;

              let role: UserRole = UserRole.RELIEVER;
              const normalizedRole = (rawRole || '').toLowerCase();

              if (normalizedRole.includes('operator')) {
                role = UserRole.OPERATOR;
              } else if (normalizedRole.includes('team leader') || normalizedRole.includes('leader') || normalizedRole.includes('tl')) {
                role = UserRole.TEAM_LEADER;
              } else if (normalizedRole.includes('incharge') || normalizedRole.includes('in-charge')) {
                role = UserRole.INCHARGE;
              } else if (normalizedRole.includes('project manager') || normalizedRole.includes('pm')) {
                role = UserRole.PROJECT_MANAGER;
              } else {
                role = UserRole.RELIEVER;
              }

              return { id, name, role, username, password };
            })
            .filter((u): u is User => u !== null);

          resolve(users);
        },
        error: (error: any) => reject(new Error('Parser Failure: ' + error.message))
      });
    });
  } catch (error: any) {
    if (error.message === 'Failed to fetch') {
      throw new Error('Cloud Synchronization Blocked. In Google Sheets, go to File > Share > Publish to web, select "CSV", and click Publish.');
    }
    throw error;
  }
};

export const logRequestToCloud = async (request: LeaveRequest): Promise<boolean> => {
  if (!APPS_SCRIPT_URL) return false;
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(request),
      headers: { 'Content-Type': 'application/json' }
    });
    return response.ok;
  } catch (error) {
    console.error("Cloud Logging Failed:", error);
    return false;
  }
};
