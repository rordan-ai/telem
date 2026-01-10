import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Loader2, RefreshCw, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CandidateCard from "@/components/CandidateCard";
import PositionTabs from "@/components/PositionTabs";

const SHEET_ID = "12MZERyehuXxMUix9LYQSpdjespJ2bpDx1nyQYG-M4N4";

export default function Recruitment() {
  const [activePosition, setActivePosition] = useState("general");
  const [importMessage, setImportMessage] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => base44.entities.Candidate.list("-created_date")
  });

  const filteredCandidates = candidates.filter((c) => {
    const matchesPosition = c.position === activePosition;
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery);
    return matchesPosition && matchesSearch;
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
        if (row.some(c => c)) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }
    
    // Add the last row if it exists
    row.push(cell.trim());
    if (row.some(c => c)) rows.push(row);
    
    return rows;
  };

  const fetchAndImport = async () => {
    setIsImporting(true);

    try {
      const existingCandidates = await base44.entities.Candidate.list();
      const existingPhones = new Set(existingCandidates.map((c) => c.phone.replace(/\D/g, "")));
      const newCandidates = [];
      let totalDuplicates = 0;

      const tabs = [
        { name: "general", sheetName: "עובדים כללי" },
        { name: "segan_tzoran", sheetName: "סגן צורן" },
        { name: "segan_beer_yaakov", sheetName: "סגן באר יעקב" },
        { name: "manager_commerce", sheetName: "מנהל סחר" }
      ];

      for (const tab of tabs) {
        try {
          // Fetch via Google Sheets CSV (more reliable and CORS-friendly)
          const sheetNameEncoded = encodeURIComponent(tab.sheetName);
          const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheetNameEncoded}`;
          console.log(`Fetching ${tab.name} from: ${url}`);

          const response = await fetch(url);
          if (!response.ok) {
            console.error(`Failed to fetch ${tab.name}:`, response.status);
            continue;
          }

          const csvText = await response.text();
          console.log(`Tab ${tab.name}: fetched ${csvText.length} chars`);

          const rows = parseCSV(csvText);
          console.log(`Tab ${tab.name}: parsed ${rows.length} rows`);

          if (!rows || rows.length < 2) {
            console.warn(`Tab ${tab.name}: No data rows returned`);
            continue;
          }

          const normalizeHeader = (t) => String(t || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
          const headers = rows[0].map(normalizeHeader);
          console.log(`Tab ${tab.name} headers:`, headers);

          // Prefer exact Hebrew header matches first, then fallback to contains
          const findIndexSmart = (possibleNames) => {
            for (const name of possibleNames) {
              const exact = headers.findIndex(h => String(h).trim() === name);
              if (exact !== -1) return exact;
            }
            for (const name of possibleNames) {
              const idx = headers.findIndex(h => String(h).toLowerCase().includes(name.toLowerCase()));
              if (idx !== -1) return idx;
            }
            return -1;
          };

          const idx = {
            name: findIndexSmart(["שם מועמד", "שם מלא", "שם"]),
            phone: findIndexSmart(["טלפון", "נייד", "סלולרי"]),
            email: findIndexSmart(["אימייל", "דואר", "מייל"]),
            branch: findIndexSmart(["מודעה", "סניף", "מועמדות לסניף"]),
            campaign: findIndexSmart(["שם הקמפיין", "קמפיין"]),
            time: findIndexSmart(["תאריך ושעה", "תאריך", "שעה"]),
            city: findIndexSmart(["ישוב מגורים", "מגורים", "עיר", "ישוב"]),
            exp: findIndexSmart(["האם יש ניסיון", "ניסיון"]),
            job: findIndexSmart(["מועמד למשרה", "משרה", "תפקיד"]),
            expDesc: findIndexSmart(["תאור קצר ניסיון", "תיאור", "תאור", "תאור קצר"]),
            working: findIndexSmart(["עובד כרגע?", "עובד כרגע"]),
            transport: findIndexSmart(["רכב/ניידות", "רכב", "ניידות", "מרחק"]),
            notes: findIndexSmart(["הערות"])
          };

          console.log(`Tab ${tab.name} column mapping:`, idx);

          if (idx.name === -1 || idx.phone === -1) {
            console.error(`Missing required columns in ${tab.name}. Name index: ${idx.name}, Phone index: ${idx.phone}`);
            continue;
          }

          let duplicateCount = 0;

          for (const row of rows.slice(1)) {
            const name = row[idx.name];
            const phone = row[idx.phone];
            
            // Only skip if name or phone is missing - these are required fields
            if (!name || !phone) continue;

            const cleanPhone = String(phone).replace(/\D/g, "");
            // Only skip if phone is invalid format
            if (!cleanPhone || cleanPhone.length < 9) continue;
            
            if (existingPhones.has(cleanPhone)) {
               duplicateCount++;
               totalDuplicates++;
               continue;
            }

            newCandidates.push({
              name: String(name),
              phone: String(phone),
              email: idx.email !== -1 ? String(row[idx.email] || "") : "",
              position: tab.name,
              branch: idx.branch !== -1 ? String(row[idx.branch] || "") : "",
              campaign: idx.campaign !== -1 ? String(row[idx.campaign] || "") : "",
              contact_time: idx.time !== -1 ? String(row[idx.time] || "") : "",
              city: idx.city !== -1 ? String(row[idx.city] || "") : "",
              has_experience: idx.exp !== -1 ? String(row[idx.exp] || "") : "",
              job_title: idx.job !== -1 ? String(row[idx.job] || "") : "",
              experience_description: idx.expDesc !== -1 ? String(row[idx.expDesc] || "") : "",
              currently_working: idx.working !== -1 ? String(row[idx.working] || "") : "",
              transportation: idx.transport !== -1 ? String(row[idx.transport] || "") : "",
              status: "not_handled",
              notes: idx.notes !== -1 ? String(row[idx.notes] || "") : "",
              sheet_row_id: `${tab.name}_${cleanPhone}_${Date.now()}`
            });

            existingPhones.add(cleanPhone);
          }
        } catch (tabError) {
          console.error(`Error fetching ${tab.name} tab:`, tabError);
        }
      }

      // Handle new candidates
      if (newCandidates.length > 0) {
        await base44.entities.Candidate.bulkCreate(newCandidates);
      }

      queryClient.invalidateQueries({ queryKey: ["candidates"] });

      // Generate detailed report
      const stats = tabs.map(t => {
        const count = newCandidates.filter(c => c.position === t.name).length;
        return `${t.sheetName}: ${count}`;
      }).join(" | ");
      
      setImportMessage(`סיום: ${newCandidates.length} חדשים, ${totalDuplicates} כפולים. (${stats})`);
      setTimeout(() => setImportMessage(null), 10000);

    } catch (error) {
      console.error("Import error:", error);
      setImportMessage("שגיאה ביבוא נתונים: " + error.message);
    }

    setIsImporting(false);
  };



  // Auto-import on load and every 5 minutes
  useEffect(() => {
    fetchAndImport();
    const interval = setInterval(() => {
      fetchAndImport();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdate = async () => {
   await fetchAndImport();
   queryClient.invalidateQueries({ queryKey: ["candidates"] });
  };

  const positionLabels = {
    general: "עובדים כללי",
    segan_tzoran: "סגן צורן",
    segan_beer_yaakov: "סגן באר יעקב",
    manager_commerce: "מנהל סחר"
  };
  const positionLabel = positionLabels[activePosition] || activePosition;

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

          <div className="relative mt-4">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש לפי שם או טלפון..."
              className="bg-slate-800 border-slate-700 text-slate-50 placeholder:text-slate-500 pr-10" 
            />
          </div>

        </div>
      </header>

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
          <span className="bg-slate-900 text-slate-50 px-3 py-1 text-sm rounded-full">
            {filteredCandidates.length} מועמדים
          </span>
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