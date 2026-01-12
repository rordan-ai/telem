import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Loader2, RefreshCw, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CandidateCard from "@/components/CandidateCard";
import PositionTabs from "@/components/PositionTabs";


const SHEET_ID = "12MZERyehuXxMUix9LYQSpdjespJ2bpDx1nyQYG-M4N4";

export default function Recruitment() {
  const [activePosition, setActivePosition] = useState("general");
  const [importMessage, setImportMessage] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [showBranchModal, setShowBranchModal] = useState(false);

  const queryClient = useQueryClient();

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => base44.entities.Candidate.list("-created_date")
  });

  const filteredCandidates = candidates
    .filter((c) => {
      const matchesPosition = c.position === activePosition;
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery);
      const notDeleted = !c.is_deleted_by_app;
      const matchesBranch = !selectedBranch || c.branch === selectedBranch;
      
      if (!matchesPosition) {
        console.log(`🔍 ${c.name} לא מתאים לתפקיד ${activePosition} (תפקיד: ${c.position})`);
      }
      if (!notDeleted) {
        console.log(`🗑️ ${c.name} נמחק באפליקציה`);
      }
      
      return matchesPosition && matchesSearch && notDeleted && matchesBranch;
    })
    .sort((a, b) => {
      const dateA = a.contact_time ? new Date(a.contact_time).getTime() : 0;
      const dateB = b.contact_time ? new Date(b.contact_time).getTime() : 0;
      return dateB - dateA;
    });



  // Robust CSV Parser that handles multi-line cells correctly
  const parseCSV = (text) => {
    const rows = [];
    let row = [];
    let cell = "";
    let insideQuote = false;
    
    // Normalize newlines to avoid platform specific issues
    const input = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const nextChar = input[i + 1];
      
      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          cell += '"';
          i++; // Skip escape
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
    
    // Add the last row if it exists
    row.push(cell.trim());
    rows.push(row);
    
    return rows;
  };

  const fetchAndImport = async () => {
    setIsImporting(true);
    console.log("🔄 התחלת ייבוא נתונים...");
    try {
      // טעינת כל המועמדים הקיימים מה-DB
      const existingCandidates = await base44.entities.Candidate.list();
      console.log(`✅ נטענו ${existingCandidates.length} מועמדים קיימים מה-DB`);
      
      // יצירת מפה לזיהוי מהיר של מועמדים קיימים
      const existingMap = new Map();
      existingCandidates.forEach(c => {
        const key = `${c.name}_${c.phone}_${c.position}`;
        existingMap.set(key, c);
      });

      const tabs = [
        { name: "general", sheetName: "עובדים כללי" },
        { name: "segan_tzoran", sheetName: "סגן צורן" },
        { name: "segan_beer_yaakov", sheetName: "סגן באר יעקב" },
        { name: "manager_commerce", sheetName: "מנהל סחר" },
        { name: "climbing_wall", sheetName: "קיר טיפוס" }
      ];

      const toCreate = [];
      const toUpdate = [];

      for (const tab of tabs) {
        console.log(`📊 מעבד גיליון: ${tab.sheetName} (${tab.name})`);
        const sheetNameEncoded = encodeURIComponent(tab.sheetName);
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheetNameEncoded}`;
        const res = await fetch(url);
        if (!res.ok) {
          console.log(`❌ נכשל לטעון גיליון: ${tab.sheetName}`);
          continue;
        }
        const csvText = await res.text();

        const rows = parseCSV(csvText);
        console.log(`📝 נמצאו ${rows.length - 1} שורות בגיליון ${tab.sheetName}`);
        if (!rows || rows.length < 2) {
          console.log(`⚠️ אין מספיק שורות בגיליון ${tab.sheetName}`);
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
          if (tab.name === "segan_tzoran" || tab.name === "segan_beer_yaakov") {
            return 2;
          }
          let i = headers.findIndex(h => h === "שם מועמד" || h === "שם מלא");
          if (i !== -1) return i;
          i = headers.findIndex(h => h.includes("מועמד") || h.includes("שם מלא"));
          if (i !== -1) return i;
          return headers.findIndex(h => h.startsWith("שם") && !h.includes("קמפיין"));
        })();

        const idx = {
          name: nameIdx,
          phone: findIndex(["טלפון", "נייד", "סלולרי"]),
          email: findIndex(["אימייל", "דואר", "מייל"]),
          branch: findIndex(["מודעה", "סניף", "מועמדות לסניף"]),
          campaign: findIndex(["שם הקמפיין", "קמפיין"]),
          time: findIndex(["תאריך ושעה", "תאריך", "שעה", "תאיך כניסה"]),
          city: findIndex(["ישוב מגורים", "מגורים", "עיר", "ישוב"]),
          exp: findIndex(["האם יש ניסיון", "ניסיון"]),
          job: findIndex(["מועמד למשרה", "משרה", "תפקיד"]),
          expDesc: findIndex(["תאור קצר ניסיון", "תיאור", "תאור", "תאור קצר"]),
          working: findIndex(["עובד כרגע?", "עובד כרגע"]),
          transport: findIndex(["רכב/ניידות", "רכב", "ניידות", "מרחק"]),
          notesFromSheet: 12, // עמודת M
          commerceExp: tab.name === "manager_commerce" ? 2 : -1,
          comax: tab.name === "manager_commerce" ? 3 : -1,
          planogram: tab.name === "manager_commerce" ? 4 : -1,
          supplierNeg: tab.name === "manager_commerce" ? 5 : -1,
          pnl: tab.name === "manager_commerce" ? 6 : -1,
          availability: tab.name === "manager_commerce" ? 7 : -1,
          instructionExp: tab.name === "climbing_wall" ? findIndex(["ניסיון הדרכה"]) : -1,
          climbingExp: tab.name === "climbing_wall" ? findIndex(["ניסיון בטיפוס"]) : -1,
          socialMedia: tab.name === "climbing_wall" ? findIndex(["פוסט אינסטגרם", "פוסט", "אינסטגרם"]) : -1,
          escortExp: tab.name === "climbing_wall" ? findIndex(["ליווי ניסיון"]) : -1,
          verificationDate: tab.name === "climbing_wall" ? findIndex(["אימות תאריך", "תאריך המעמדה"]) : -1
        };

        // עיבוד כל שורה מהגיליון
        for (const row of rows.slice(1)) {
          const name = idx.name !== -1 ? String(row[idx.name] ?? '').trim() : '';
          const phone = idx.phone !== -1 ? String(row[idx.phone] ?? '').trim() : '';
          
          console.log(`🔎 מעבד שורה: שם='${name}', טלפון='${phone}', גיליון=${tab.sheetName}`);

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
            candidateData.climbing_experience = idx.climbingExp !== -1 ? String(row[idx.climbingExp] ?? '') : '';
            candidateData.social_media_source = idx.socialMedia !== -1 ? String(row[idx.socialMedia] ?? '') : '';
            candidateData.escort_experience = idx.escortExp !== -1 ? String(row[idx.escortExp] ?? '') : '';
            candidateData.verification_date = idx.verificationDate !== -1 ? String(row[idx.verificationDate] ?? '') : '';
          }

          // חיפוש מועמד קיים
          const key = `${name}_${phone}_${tab.name}`;
          const existingCandidate = existingMap.get(key);

          if (existingCandidate) {
            // מועמד קיים - בדיקה אם נמחק ע"י האפליקציה
            if (existingCandidate.is_deleted_by_app) {
              // דילוג על מועמדים שנמחקו באפליקציה
              continue;
            }
            
            // האפליקציה קובעת - אם יש הערות באפליקציה, לא לדרוס אותן מהגיליון
            if (existingCandidate.notes && existingCandidate.notes.trim() !== '') {
              candidateData.notes = existingCandidate.notes;
            } else {
              // אם אין הערות באפליקציה, נשתמש בהערות מהגיליון
              candidateData.notes = notesFromSheet;
            }
            
            // בדיקה אם יש שינויים בפועל - השוואת נתונים
            let hasChanges = false;
            for (const key in candidateData) {
              if (candidateData[key] !== existingCandidate[key]) {
                hasChanges = true;
                console.log(`   שינוי ב-${name}: שדה ${key} משתנה מ-"${existingCandidate[key]}" ל-"${candidateData[key]}"`);
                break;
              }
            }
            
            // רק אם יש שינויים - מוסיפים לרשימת העדכונים
            if (hasChanges) {
              toUpdate.push({
                id: existingCandidate.id,
                data: candidateData
              });
            }
          } else {
            // מועמד חדש - נשתמש בהערות מהגיליון
            candidateData.status = "not_handled";
            candidateData.notes = notesFromSheet;
            candidateData.is_deleted_by_app = false;
            toCreate.push(candidateData);
            console.log(`✅ מועמד חדש נוסף: ${name}`);
          }
        }
      }

      console.log(`\n📊 סיכום:`);
      console.log(`   🆕 מועמדים חדשים ליצירה: ${toCreate.length}`);
      console.log(`   🔄 מועמדים קיימים לעדכון: ${toUpdate.length}`);

      // ביצוע עדכונים
      console.log(`\n🔄 מתחיל עדכון ${toUpdate.length} מועמדים...`);
      for (let i = 0; i < toUpdate.length; i++) {
        const update = toUpdate[i];
        console.log(`   עדכון ${i + 1}/${toUpdate.length}: ${update.data.name}`);
        await base44.entities.Candidate.update(update.id, update.data);
      }
      console.log(`✅ סיימתי לעדכן ${toUpdate.length} מועמדים`);

      // ביצוע הוספות
      if (toCreate.length > 0) {
        console.log(`\n➕ מתחיל הוספת ${toCreate.length} מועמדים חדשים...`);
        const batchSize = 25;
        for (let i = 0; i < toCreate.length; i += batchSize) {
          const batch = toCreate.slice(i, i + batchSize);
          console.log(`   הוספת מנה ${Math.floor(i / batchSize) + 1}: ${batch.length} מועמדים`);
          await base44.entities.Candidate.bulkCreate(batch);
          if (i + batchSize < toCreate.length) {
            await new Promise(r => setTimeout(r, 300));
          }
        }
        console.log(`✅ סיימתי להוסיף ${toCreate.length} מועמדים חדשים`);
      }

      console.log(`\n🔄 מרענן את הרשימה...`);
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      console.log(`✅ הייבוא הושלם בהצלחה!`);
      setImportMessage(`עודכנו ${toUpdate.length} מועמדים, נוספו ${toCreate.length} חדשים`);
      setTimeout(() => setImportMessage(null), 8000);
    } catch (e) {
      console.error("❌ שגיאה בייבוא:", e);
      console.error("פרטי השגיאה:", e.message, e.stack);
      setImportMessage(`שגיאה: ${e.message || "בייבוא נתונים"}`);
      setTimeout(() => setImportMessage(null), 8000);
    }
    setIsImporting(false);
    console.log("🏁 תהליך הייבוא הסתיים");
  };

  // רענון אוטומטי: בטעינה ראשונית וכל דקה
  useEffect(() => {
    // רענון ראשוני
    fetchAndImport();

    // רענון אוטומטי כל דקה
    const intervalId = setInterval(() => {
      fetchAndImport();
    }, 60000); // 60 שניות = דקה

    // ניקוי interval כשהקומפוננטה מתפרקת
    return () => clearInterval(intervalId);
  }, []);

  const handleUpdate = async () => {
   queryClient.invalidateQueries({ queryKey: ["candidates"] });
  };

  const positionLabels = {
    general: "עובדים כללי",
    segan_tzoran: "סגן צורן",
    segan_beer_yaakov: "סגן באר יעקב",
    manager_commerce: "מנהל סחר",
    climbing_wall: "קיר טיפוס"
  };
  const positionLabel = positionLabels[activePosition] || activePosition;

  // Get unique branches from candidates
  const uniqueBranches = [...new Set(candidates.map(c => c.branch).filter(b => b && b.trim() !== ''))];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="bg-slate-900 mx-auto px-4 py-4 max-w-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-slate-50 text-xl font-bold">גיוס מועמדים</h1>
              <p className="text-slate-50 text-sm">ניהול מועמדים לתפקידים</p>
            </div>
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69627124175a0ec7a8b42b8e/8021c79b4_LogoTelemarket-0212.jpg"
              alt="תלם מרקט לוגו"
              className="w-16 h-16 rounded-full object-cover shadow-md" />

          </div>
          
          <PositionTabs
            activePosition={activePosition}
            onPositionChange={setActivePosition} />

          <div className="flex gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חיפוש לפי שם או טלפון..."
                className="bg-slate-800 border-slate-700 text-slate-50 placeholder:text-slate-500 pr-10" 
              />
            </div>
            <Button
              onClick={() => setShowBranchModal(true)}
              className="bg-slate-800 border-slate-700 text-slate-50 hover:bg-slate-700 px-4"
              variant="outline"
            >
              <Filter className="w-4 h-4 ml-2" />
              {selectedBranch ? 'סנן מודעה' : 'מיון מודעה'}
            </Button>
          </div>

          </div>
          </header>

          {/* Branch Filter Modal */}
          <Dialog open={showBranchModal} onOpenChange={setShowBranchModal}>
          <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>בחר מודעה לסינון</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <Button
              onClick={() => {
                setSelectedBranch(null);
                setShowBranchModal(false);
              }}
              className={`w-full justify-start ${!selectedBranch ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}
              variant={!selectedBranch ? "default" : "outline"}
            >
              כל המודעות
            </Button>
            {uniqueBranches.sort().map((branch) => (
              <Button
                key={branch}
                onClick={() => {
                  setSelectedBranch(branch);
                  setShowBranchModal(false);
                }}
                className={`w-full justify-start ${selectedBranch === branch ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}
                variant={selectedBranch === branch ? "default" : "outline"}
              >
                {branch}
              </Button>
            ))}
          </div>
          </DialogContent>
          </Dialog>

      {/* Main Content */}
      <main className="bg-slate-500 mx-auto px-4 py-6 max-w-lg">
        {/* Import button and status */}
        <div className="mb-4 space-y-3">
          <Button
            onClick={fetchAndImport}
            disabled={isImporting} className="bg-slate-300 text-slate-900 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-9 w-full hover:bg-blue-700">


            {isImporting ?
            <>
                <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
                מייבא מהגיליון...
              </> :

            <>
                <RefreshCw className="w-4 h-4 ml-2" />
                רענון נתונים
              </>
            }
          </Button>
          
          {importMessage &&
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">

              <div className="flex items-center justify-center gap-2 text-sm text-emerald-700">
                <span className="font-medium">{importMessage}</span>
              </div>
            </motion.div>
          }


        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-700">
            מועמדים ל{positionLabel}
          </h2>
          <div className="flex gap-2 items-center">
            <span className="bg-red-900 text-white px-3 py-1 text-sm rounded-full">
              {candidates.filter(c => c.position === activePosition && c.is_deleted_by_app).length} נמחקו
            </span>
            <span className="bg-slate-900 text-slate-50 px-3 py-1 text-sm rounded-full">
              {filteredCandidates.length} מועמדים
            </span>
          </div>
        </div>

        {/* Candidates List */}
        {isLoading ?
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          </div> :
        filteredCandidates.length === 0 ?
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20">

            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium">אין מועמדים ל{positionLabel}</p>
            <p className="text-slate-400 text-sm mt-1">
              לחץ על "רענון נתונים" להוספת מועמדים
            </p>
          </motion.div> :

        <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredCandidates.map((candidate, index) =>
            <motion.div
              key={candidate.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}>

                  <CandidateCard
                candidate={candidate}
                onUpdate={handleUpdate} />

                </motion.div>
            )}
            </AnimatePresence>
          </div>
        }
      </main>
    </div>);

}