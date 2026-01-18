import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SHEET_ID = "12MZERyehuXxMUix9LYQSpdjespJ2bpDx1nyQYG-M4N4";

// Hebrew to English transliteration map
const hebrewToEnglishMap = {
  'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z',
  'ח': 'ch', 'ט': 't', 'י': 'i', 'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm',
  'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p', 'ף': 'p',
  'צ': 'ts', 'ץ': 'ts', 'ק': 'k', 'ר': 'r', 'ש': 'sh', 'ת': 't'
};

// Convert Hebrew name to English approximation
const hebrewToEnglish = (hebrewName) => {
  if (!hebrewName) return '';
  return hebrewName.split('').map(char => hebrewToEnglishMap[char] || char).join('').toLowerCase();
};

// Normalize name for comparison (remove spaces, lowercase)
const normalizeName = (name) => {
  if (!name) return '';
  return name.replace(/\s+/g, '').toLowerCase();
};

// Check if two names match (supports Hebrew/English)
const namesMatch = (name1, name2) => {
  if (!name1 || !name2) return false;
  
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);
  
  // Direct match
  if (norm1 === norm2) return true;
  
  // Contains match
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  
  // Hebrew to English transliteration match
  const eng1 = hebrewToEnglish(name1);
  const eng2 = hebrewToEnglish(name2);
  
  if (eng1 && eng2) {
    if (eng1 === eng2) return true;
    if (eng1.includes(eng2) || eng2.includes(eng1)) return true;
  }
  
  // Check if one is Hebrew transliteration of the other
  if (eng1 && norm2.includes(eng1.substring(0, 4))) return true;
  if (eng2 && norm1.includes(eng2.substring(0, 4))) return true;
  
  return false;
};

// Robust CSV Parser
const parseCSV = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuote = false;
  
  const input = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const nextChar = input[i + 1];
    
    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      row.push(cell.trim());
      cell = "";
    } else if (char === '\n' && !insideQuote) {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  
  row.push(cell.trim());
  rows.push(row);
  
  return rows;
};

Deno.serve(async (req) => {
  console.log("🚀 [START] importCandidates function called");
  console.log("📋 [DEBUG] Request method:", req.method);
  console.log("📋 [DEBUG] Request headers:", JSON.stringify(Object.fromEntries(req.headers.entries())));
  
  try {
    console.log("🔧 [STEP 1] Creating base44 client from request...");
    const base44 = createClientFromRequest(req);
    console.log("✅ [STEP 1] base44 client created successfully");
    
    // פונקציה זו משתמשת ב-asServiceRole ולכן לא דורשת אימות משתמש
    console.log("🔐 [STEP 2] Skipping user authentication - using service role for all operations");

    console.log("🔄 [STEP 3] Starting data import...");
    
    // טעינת כל המועמדים הקיימים
    console.log("📥 [STEP 4] Loading existing candidates with asServiceRole...");
    let existingCandidates = [];
    try {
      existingCandidates = await base44.asServiceRole.entities.Candidate.list();
      console.log(`✅ [STEP 4] Loaded ${existingCandidates.length} existing candidates`);
    } catch (loadError) {
      console.log("❌ [STEP 4] Failed to load candidates:", loadError.message);
      console.log("❌ [STEP 4] Error stack:", loadError.stack);
      return Response.json({ 
        error: `Failed to load candidates: ${loadError.message}`,
        success: false,
        debug: { step: 'load_candidates' }
      }, { status: 500 });
    }
    
    const existingMap = new Map();
    existingCandidates.forEach(c => {
      const key = `${c.name}_${c.phone}_${c.position}`;
      existingMap.set(key, c);
    });

    const tabs = [
      { name: "general", sheetName: "עובדים כללי" },
      { name: "accountant_manager", sheetName: "מנהח\"ש" },
      { name: "segan_beer_yaakov", sheetName: "סגן באר יעקב" },
      { name: "manager_commerce", sheetName: "מנהל סחר" },
      { name: "climbing_wall", sheetName: "קיר טיפוס" },
      { name: "cv_update", sheetName: "קורות חיים" }
    ];

    // שליפה מקבילית של כל הגיליונות
    console.log(`📊 [STEP 5] Fetching ${tabs.length} sheets in parallel...`);
    const fetchPromises = tabs.map(async (tab) => {
      try {
        const sheetNameEncoded = encodeURIComponent(tab.sheetName);
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheetNameEncoded}`;
        console.log(`🔍 [STEP 5] Fetching sheet: ${tab.sheetName}`);
        const res = await fetch(url, { 
          signal: AbortSignal.timeout(10000)
        });
        if (!res.ok) {
          console.log(`❌ [STEP 5] Failed to fetch ${tab.sheetName}: status ${res.status}`);
          return null;
        }
        const csvText = await res.text();
        console.log(`✅ [STEP 5] Fetched ${tab.sheetName} (${csvText.length} chars)`);
        return { tab, csvText };
      } catch (err) {
        console.log(`❌ [STEP 5] Error fetching ${tab.sheetName}:`, err.message);
        return null;
      }
    });
    
    const allSheets = await Promise.all(fetchPromises);
    console.log(`✅ [STEP 5] All sheets fetched`);

    const toCreate = [];
    const toUpdate = [];

    console.log(`📊 [STEP 6] Processing sheets...`);
    
    // Process CV update sheet separately
    const cvSheet = allSheets.find(s => s && s.tab.name === "cv_update");
    if (cvSheet) {
      console.log(`📄 [CV] Processing CV update sheet...`);
      const cvRows = parseCSV(cvSheet.csvText);
      console.log(`📄 [CV] Found ${cvRows?.length || 0} rows in CV sheet`);
      if (cvRows && cvRows.length > 1) {
        console.log(`📄 [CV] Headers: ${JSON.stringify(cvRows[0])}`);
        console.log(`📄 [CV] First data row: ${JSON.stringify(cvRows[1])}`);
        let cvUpdated = 0;
        for (const row of cvRows.slice(1)) {
          // עמודות: A=שם מועמד (0), B=תפקיד (1), C=קורות חיים URL (2), D=אימייל (3)
          const cvName = String(row[0] ?? '').trim();
          const cvJobTitle = String(row[1] ?? '').trim();
          const cvUrl = String(row[2] ?? '').trim();
          const cvEmail = String(row[3] ?? '').trim();
          
          console.log(`📄 [CV] Processing: name="${cvName}", job="${cvJobTitle}", url="${cvUrl?.substring(0,30)}...", email="${cvEmail}"`);
          
          if (!cvName || !cvUrl) {
            console.log(`📄 [CV] Skipping - missing name or url`);
            continue;
          }
          
          // חיפוש מועמד קיים
          let foundCandidate = null;
          
          // 1. ניסיון התאמה לפי אימייל (אם קיים)
          if (cvEmail) {
            foundCandidate = existingCandidates.find(c => 
              c.email && c.email.toLowerCase() === cvEmail.toLowerCase()
            );
          }
          
          // 2. ניסיון התאמה לפי שם + תפקיד
          if (!foundCandidate) {
            foundCandidate = existingCandidates.find(c => {
              const nameMatches = namesMatch(c.name, cvName);
              if (!nameMatches) return false;
              
              // אם יש תפקיד בגיליון, לבדוק התאמה
              if (cvJobTitle) {
                const jobMatches = c.job_title && (
                  c.job_title.includes(cvJobTitle) || 
                  cvJobTitle.includes(c.job_title) ||
                  c.branch && (c.branch.includes(cvJobTitle) || cvJobTitle.includes(c.branch))
                );
                return jobMatches;
              }
              return true;
            });
          }
          
          // 3. ניסיון התאמה לפי שם בלבד (אם לא נמצא)
          if (!foundCandidate) {
            foundCandidate = existingCandidates.find(c => namesMatch(c.name, cvName));
          }
          
          if (foundCandidate) {
            // עדכון קורות חיים ואימייל (אם קיים)
            const updateData = { cv_url: cvUrl };
            if (cvEmail && !foundCandidate.email) {
              updateData.email = cvEmail;
            }
            
            toUpdate.push({
              id: foundCandidate.id,
              data: updateData
            });
            cvUpdated++;
            console.log(`✅ [CV] Matched: ${cvName} -> ${foundCandidate.name} (${foundCandidate.id})`);
          } else {
            console.log(`⚠️ [CV] No match found for: ${cvName} (${cvJobTitle})`);
          }
        }
        console.log(`📄 [CV] Updated ${cvUpdated} candidates with CV links`);
      }
    }
    
    for (const sheetData of allSheets) {
      if (!sheetData || sheetData.tab.name === "cv_update") continue;
      const { tab, csvText } = sheetData;
      console.log(`📊 [STEP 6] Processing: ${tab.sheetName}`);

      const rows = parseCSV(csvText);
      if (!rows || rows.length < 2) {
        console.log(`⚠️ [STEP 6] Not enough rows in ${tab.sheetName}`);
        continue;
      }

      const normalizeHeader = (t) => String(t || '')
        .replace(/\uFEFF/g, '')
        .replace(/[\u200B-\u200D\u2060]/g, '')
        .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const headers = rows[0].map(normalizeHeader);

      const findIndex = (names) => {
        for (const n of names) {
          const i = headers.findIndex(h => h === n);
          if (i !== -1) return i;
        }
        for (const n of names) {
          const i = headers.findIndex(h => h.includes(n));
          if (i !== -1) return i;
        }
        return -1;
      };

      const nameIdx = (() => {
        if (tab.name === "segan_beer_yaakov") {
          return 2;
        }
        if (tab.name === "accountant_manager") {
          return 1; // עמודה B - שם
        }
        let i = headers.findIndex(h => h === "שם מועמד" || h === "שם מלא");
        if (i !== -1) return i;
        i = headers.findIndex(h => h.includes("מועמד") || h.includes("שם מלא"));
        if (i !== -1) return i;
        return headers.findIndex(h => h.startsWith("שם") && !h.includes("קמפיין"));
      })();

      const idx = {
        name: tab.name === "climbing_wall" ? 2 : (tab.name === "accountant_manager" ? 1 : nameIdx),
        phone: tab.name === "climbing_wall" ? 3 : (tab.name === "accountant_manager" ? 2 : findIndex(["טלפון", "נייד", "סלולרי"])),
        email: tab.name === "climbing_wall" ? 10 : (tab.name === "accountant_manager" ? 8 : findIndex(["אימייל", "דואר", "מייל"])),
        branch: tab.name === "climbing_wall" ? 1 : findIndex(["מודעה", "סניף", "מועמדות לסניף"]),
        campaign: findIndex(["שם הקמפיין", "קמפיין"]),
        time: tab.name === "climbing_wall" ? 0 : (tab.name === "accountant_manager" ? 0 : findIndex(["תאריך ושעה", "תאריך", "שעה", "תאיך כניסה"])),
        city: tab.name === "climbing_wall" ? 4 : (tab.name === "accountant_manager" ? 7 : findIndex(["ישוב מגורים", "מגורים", "עיר", "ישוב"])),
        exp: findIndex(["האם יש ניסיון", "ניסיון"]),
        job: findIndex(["מועמד למשרה", "משרה", "תפקיד"]),
        expDesc: findIndex(["תאור קצר ניסיון", "תיאור", "תאור", "תאור קצר"]),
        working: findIndex(["עובד כרגע?", "עובד כרגע"]),
        transport: findIndex(["רכב/ניידות", "רכב", "ניידות", "מרחק"]),
        notesFromSheet: 12,
        commerceExp: tab.name === "manager_commerce" ? 2 : -1,
        comax: tab.name === "manager_commerce" ? 3 : -1,
        planogram: tab.name === "manager_commerce" ? 4 : -1,
        supplierNeg: tab.name === "manager_commerce" ? 5 : -1,
        pnl: tab.name === "manager_commerce" ? 6 : -1,
        availability: tab.name === "manager_commerce" ? 7 : -1,
        instructionExp: tab.name === "climbing_wall" ? 5 : -1,
        instructionExpDetails: tab.name === "climbing_wall" ? 6 : -1,
        physicalActivityExp: tab.name === "climbing_wall" ? 7 : -1,
        physicalActivityDetails: tab.name === "climbing_wall" ? 8 : -1,
        workHoursAvailability: tab.name === "climbing_wall" ? 9 : -1,
        // מנהלת חשבונות - עמודות ספציפיות
        accountantCertificate: tab.name === "accountant_manager" ? 3 : -1, // עמודה D - תעודת מנהלת חשבונות
        accountantExcelExp: tab.name === "accountant_manager" ? 4 : -1, // עמודה E - ניסיון באקסל
        accountantComaxExp: tab.name === "accountant_manager" ? 5 : -1, // עמודה F - ניסיון בקומקס
        accountantRoleExp: tab.name === "accountant_manager" ? 6 : -1, // עמודה G - ניסיון בתפקיד
        accountantTwoYearsExp: tab.name === "accountant_manager" ? 9 : -1 // עמודה J - האם יש שנתיים ניסיון בתחום
      };

      for (const row of rows.slice(1)) {
        const name = idx.name !== -1 ? String(row[idx.name] ?? '').trim() : '';
        const phone = idx.phone !== -1 ? String(row[idx.phone] ?? '').trim() : '';

        // דילוג על שורות ללא שם או טלפון - מונע כפילויות
        if (!name || !phone) {
          console.log(`⚠️ [STEP 6] Skipping row with empty name or phone: name="${name}", phone="${phone}"`);
          continue;
        }

        const notesFromSheet = idx.notesFromSheet !== -1 ? String(row[idx.notesFromSheet] ?? '').trim() : '';

        const candidateData = {
          name,
          phone,
          email: idx.email !== -1 ? String(row[idx.email] ?? '') : '',
          position: tab.name,
          branch: idx.branch !== -1 ? String(row[idx.branch] ?? '') : '',
          campaign: idx.campaign !== -1 ? String(row[idx.campaign] ?? '') : '',
          contact_time: idx.time !== -1 ? String(row[idx.time] ?? '') : '',
          city: idx.city !== -1 ? String(row[idx.city] ?? '') : '',
          has_experience: idx.exp !== -1 ? String(row[idx.exp] ?? '') : '',
          job_title: idx.job !== -1 ? String(row[idx.job] ?? '') : '',
          experience_description: idx.expDesc !== -1 ? String(row[idx.expDesc] ?? '') : '',
          currently_working: idx.working !== -1 ? String(row[idx.working] ?? '') : '',
          transportation: idx.transport !== -1 ? String(row[idx.transport] ?? '') : ''
        };
        
        if (tab.name === "manager_commerce") {
          candidateData.commerce_experience = idx.commerceExp !== -1 ? String(row[idx.commerceExp] ?? '') : '';
          candidateData.comax_proficiency = idx.comax !== -1 ? String(row[idx.comax] ?? '') : '';
          candidateData.planogram_skills = idx.planogram !== -1 ? String(row[idx.planogram] ?? '') : '';
          candidateData.supplier_negotiation = idx.supplierNeg !== -1 ? String(row[idx.supplierNeg] ?? '') : '';
          candidateData.pnl_analysis = idx.pnl !== -1 ? String(row[idx.pnl] ?? '') : '';
          candidateData.availability = idx.availability !== -1 ? String(row[idx.availability] ?? '') : '';
        }

        if (tab.name === "climbing_wall") {
          candidateData.instruction_experience = idx.instructionExp !== -1 ? String(row[idx.instructionExp] ?? '') : '';
          candidateData.instruction_experience_details = idx.instructionExpDetails !== -1 ? String(row[idx.instructionExpDetails] ?? '') : '';
          candidateData.physical_activity_experience = idx.physicalActivityExp !== -1 ? String(row[idx.physicalActivityExp] ?? '') : '';
          candidateData.physical_activity_details = idx.physicalActivityDetails !== -1 ? String(row[idx.physicalActivityDetails] ?? '') : '';
          candidateData.work_hours_availability = idx.workHoursAvailability !== -1 ? String(row[idx.workHoursAvailability] ?? '') : '';
        }

        if (tab.name === "accountant_manager") {
          candidateData.accountant_certificate = idx.accountantCertificate !== -1 ? String(row[idx.accountantCertificate] ?? '') : '';
          candidateData.accountant_excel_experience = idx.accountantExcelExp !== -1 ? String(row[idx.accountantExcelExp] ?? '') : '';
          candidateData.accountant_comax_experience = idx.accountantComaxExp !== -1 ? String(row[idx.accountantComaxExp] ?? '') : '';
          candidateData.accountant_role_experience = idx.accountantRoleExp !== -1 ? String(row[idx.accountantRoleExp] ?? '') : '';
          candidateData.accountant_two_years_experience = idx.accountantTwoYearsExp !== -1 ? String(row[idx.accountantTwoYearsExp] ?? '') : '';
        }

        const key = `${name}_${phone}_${tab.name}`;
        const existingCandidate = existingMap.get(key);

        if (existingCandidate) {
          if (existingCandidate.is_deleted_by_app) {
            continue;
          }
          
          if (existingCandidate.notes && existingCandidate.notes.trim() !== '') {
            candidateData.notes = existingCandidate.notes;
          } else {
            candidateData.notes = notesFromSheet;
          }
          
          let hasChanges = false;
          for (const key in candidateData) {
            if (candidateData[key] !== existingCandidate[key]) {
              hasChanges = true;
              break;
            }
          }
          
          if (hasChanges) {
            toUpdate.push({
              id: existingCandidate.id,
              data: candidateData
            });
          }
        } else {
          candidateData.status = "not_handled";
          candidateData.notes = notesFromSheet;
          candidateData.is_deleted_by_app = false;
          toCreate.push(candidateData);
        }
      }
    }

    console.log(`📊 [STEP 7] Summary: ${toCreate.length} new, ${toUpdate.length} updates`);

    // ביצוע עדכונים
    console.log(`🔄 [STEP 8] Updating ${toUpdate.length} candidates...`);
    let updateErrors = 0;
    for (let i = 0; i < toUpdate.length; i++) {
      const update = toUpdate[i];
      try {
        await base44.asServiceRole.entities.Candidate.update(update.id, update.data);
      } catch (err) {
        updateErrors++;
        console.log(`⚠️ [STEP 8] Error updating ${update.data.name}:`, err.message);
      }
    }
    console.log(`✅ [STEP 8] Updates complete. Errors: ${updateErrors}`);

    // ביצוע הוספות
    if (toCreate.length > 0) {
      console.log(`➕ [STEP 9] Creating ${toCreate.length} new candidates...`);
      const batchSize = 25;
      let createErrors = 0;
      for (let i = 0; i < toCreate.length; i += batchSize) {
        const batch = toCreate.slice(i, i + batchSize);
        try {
          await base44.asServiceRole.entities.Candidate.bulkCreate(batch);
        } catch (err) {
          createErrors++;
          console.log(`⚠️ [STEP 9] Error creating batch ${Math.floor(i / batchSize) + 1}:`, err.message);
        }
        if (i + batchSize < toCreate.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
      console.log(`✅ [STEP 9] Creates complete. Errors: ${createErrors}`);
    }

    console.log(`🏁 [DONE] Import completed successfully!`);
    
    return Response.json({
      success: true,
      created: toCreate.length,
      updated: toUpdate.length,
      message: `סנכרון הצליח. ${toCreate.length} מועמדים נוספו`
    });

  } catch (error) {
    console.error("❌ [ERROR] Import failed:", error.message);
    console.error("❌ [ERROR] Stack trace:", error.stack);
    return Response.json({ 
      error: error.message,
      success: false,
      debug: {
        step: 'unknown',
        errorType: error.constructor.name
      }
    }, { status: 500 });
  }
});