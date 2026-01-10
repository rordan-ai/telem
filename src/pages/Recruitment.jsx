import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Loader2, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import CandidateCard from "@/components/CandidateCard";
import PositionTabs from "@/components/PositionTabs";

const SHEET_ID = "12MZERyehuXxMUix9LYQSpdjespJ2bpDx1nyQYG-M4N4";

export default function Recruitment() {
  const [activePosition, setActivePosition] = useState("general");
  const [importMessage, setImportMessage] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => base44.entities.Candidate.list("-created_date")
  });

  const filteredCandidates = candidates.filter(
    (c) => c.position === activePosition
  );

  // Helper to parse full CSV with multiline support
  const parseCSV = (csvText) => {
    const rows = [];
    let currentRow = [];
    let currentCell = "";
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];

      if (char === '"') {
        if (inQuotes && csvText[i + 1] === '"') {
          currentCell += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && csvText[i + 1] === '\n') {
          i++; // Skip \r\n
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell)) {// Only add non-empty rows
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }

    // Handle last cell/row
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell)) {
      rows.push(currentRow);
    }

    return rows;
  };

  const fetchAndImport = async () => {
    setIsImporting(true);

    try {
      const existingCandidates = await base44.entities.Candidate.list();
      const existingPhones = new Set(existingCandidates.map((c) => c.phone.replace(/\D/g, "")));
      const newCandidates = [];

      // Fetch all 4 tabs - try using sheet names instead of gids
      const tabs = [
      { name: "general", sheetName: "עובדים כללי", gid: "0" },
      { name: "segan_tzoran", sheetName: "סגן צורן", gid: "637665307" },
      { name: "segan_beer_yaakov", sheetName: "סגן באר יעקב", gid: "691974204" },
      { name: "manager_commerce", sheetName: "מנהל סחר", gid: "668402077" }];


      for (const tab of tabs) {
        let csvText = null;

        // Try both gid and sheet name methods
        const attempts = [
          `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${tab.gid}`,
          `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab.sheetName)}`
        ];

        for (const url of attempts) {
          try {
            console.log(`Trying to fetch ${tab.name} from: ${url}`);
            const response = await fetch(url);
            csvText = await response.text();
            console.log(`${tab.name}: Got ${csvText.length} chars`);
            
            // Check if we got unique data (not the default sheet)
            if (csvText && csvText.length > 100) {
              break;
            }
          } catch (error) {
            console.error(`Error with ${url}:`, error);
            continue;
          }
        }

        if (!csvText || csvText.length < 10) continue;

        try {
          const rows = parseCSV(csvText);
          if (rows.length < 2) continue;

          const headers = rows[0].map((h) => h.replace(/"/g, "").toLowerCase());
          const timeIndex = 0; // תאריך ושעה
          const branchIndex = 1; // מודעה
          const campaignIndex = 2; // שם הקמפיין
          const nameIndex = 3; // שם מועמד
          const phoneIndex = 4; // טלפון
          const emailIndex = 5; // אימייל
          const cityIndex = 6; // ישוב מגורים
          const hasExperienceIndex = 7; // האם יש ניסיון
          const jobTitleIndex = 8; // מועמד למשרה
          const experienceDescIndex = 9; // תאור קצר ניסיון
          const currentlyWorkingIndex = 10; // עובד כרגע?
          const transportationIndex = 11; // רכב/ניידות
          const notesIndex = 12; // הערות
          const notesIndex2 = 13; // הערות נוסף

          for (let i = 1; i < rows.length; i++) {
          const values = rows[i];
          const name = values[nameIndex]?.replace(/"/g, "").trim();
          let phone = values[phoneIndex]?.replace(/"/g, "").trim();
          const email = values[emailIndex]?.replace(/"/g, "").trim();

          if (!name || !phone) {
            continue;
          }

          const cleanPhone = phone.replace(/\D/g, "");
          if (!cleanPhone || cleanPhone.length < 9) {
            continue;
          }
          if (existingPhones.has(cleanPhone)) {
            continue;
          }

          // Combine notes from both columns
          const note1 = values[notesIndex]?.trim().replace(/"/g, "") || "";
          const note2 = values[notesIndex2]?.trim().replace(/"/g, "") || "";
          const combinedNotes = [note1, note2].filter(n => n).join(" | ");

          newCandidates.push({
            name,
            phone,
            email: email || "",
            position: tab.name,
            branch: values[branchIndex]?.trim().replace(/"/g, "") || "",
            campaign: values[campaignIndex]?.trim().replace(/"/g, "") || "",
            contact_time: values[timeIndex]?.trim().replace(/"/g, "") || "",
            city: values[cityIndex]?.trim().replace(/"/g, "") || "",
            has_experience: values[hasExperienceIndex]?.trim().replace(/"/g, "") || "",
            job_title: values[jobTitleIndex]?.trim().replace(/"/g, "") || "",
            experience_description: values[experienceDescIndex]?.trim().replace(/"/g, "") || "",
            currently_working: values[currentlyWorkingIndex]?.trim().replace(/"/g, "") || "",
            transportation: values[transportationIndex]?.trim().replace(/"/g, "") || "",
            status: "not_handled",
            notes: combinedNotes,
            sheet_row_id: `${tab.name}_row_${i}`
          });

          existingPhones.add(cleanPhone);
          }
        } catch (tabError) {
          console.error(`Error fetching ${tab.name} tab:`, tabError);
        }
      }

      if (newCandidates.length > 0) {
        await base44.entities.Candidate.bulkCreate(newCandidates);
        setImportMessage(`נוספו ${newCandidates.length} מועמדים חדשים`);
        setTimeout(() => setImportMessage(null), 4000);
        queryClient.invalidateQueries({ queryKey: ["candidates"] });
      } else {
        setImportMessage("כל המועמדים כבר קיימים במערכת");
        setTimeout(() => setImportMessage(null), 4000);
      }
    } catch (error) {
      console.error("Import error:", error);
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

  const handleUpdate = () => {
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