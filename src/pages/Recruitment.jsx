import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Loader2, RefreshCw, Search } from "lucide-react";
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
      // מחיקת כל המועמדים הקיימים במכה אחת
      const existing = await base44.entities.Candidate.list();
      if (existing.length > 0) {
        await Promise.all(existing.map(c => base44.entities.Candidate.delete(c.id)));
      }

      const tabs = [
        { name: "general", sheetName: "עובדים כללי" },
        { name: "segan_tzoran", sheetName: "סגן צורן" },
        { name: "segan_beer_yaakov", sheetName: "סגן באר יעקב" },
        { name: "manager_commerce", sheetName: "מנהל סחר" }
      ];

      const newCandidates = [];

      for (const tab of tabs) {
        
        const sheetNameEncoded = encodeURIComponent(tab.sheetName);
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheetNameEncoded}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const csvText = await res.text();
        const rows = parseCSV(csvText);
        if (!rows || rows.length < 2) continue;

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
          time: findIndex(["תאריך ושעה", "תאריך", "שעה"]),
          city: findIndex(["ישוב מגורים", "מגורים", "עיר", "ישוב"]),
          exp: findIndex(["האם יש ניסיון", "ניסיון"]),
          job: findIndex(["מועמד למשרה", "משרה", "תפקיד"]),
          expDesc: findIndex(["תאור קצר ניסיון", "תיאור", "תאור", "תאור קצר"]),
          working: findIndex(["עובד כרגע?", "עובד כרגע"]),
          transport: findIndex(["רכב/ניידות", "רכב", "ניידות", "מרחק"]),
          notes: findIndex(["הערות"])
        };

        for (const row of rows.slice(1)) {
          const name = idx.name !== -1 ? String(row[idx.name] ?? '') : '';
          const phoneRaw = idx.phone !== -1 ? String(row[idx.phone] ?? '') : '';
          const cleaned = String(phoneRaw).replace(/\D/g, '');

          // ללא סינון - מייבא הכל

          newCandidates.push({
            name,
            phone: phoneRaw,
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
            transportation: idx.transport !== -1 ? String(row[idx.transport] ?? '') : '',
            status: "not_handled",
            notes: idx.notes !== -1 ? String(row[idx.notes] ?? '') : '',
            sheet_row_id: `${tab.name}_${cleaned || Date.now()}_${Math.random().toString(36).slice(2,8)}`
          });

        }
      }

      if (newCandidates.length) {
        await base44.entities.Candidate.bulkCreate(newCandidates);
      }

      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      setImportMessage(`יובאו ${newCandidates.length} שורות.`);
      setTimeout(() => setImportMessage(null), 8000);
    } catch (e) {
      setImportMessage("שגיאה בייבוא נתונים.");
      setTimeout(() => setImportMessage(null), 8000);
    }
    setIsImporting(false);
  };



  // ללא auto-import - רק ידני
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const handleUpdate = async () => {
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