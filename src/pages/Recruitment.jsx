import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Loader2, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import CandidateCard from "@/components/CandidateCard";
import PositionTabs from "@/components/PositionTabs";

const SHEET_ID = "1GQvdNPj_kAgpMQjveUGpMxQI0E3AtAP9bXXA6J2Mm1o";

export default function Recruitment() {
  const [activePosition, setActivePosition] = useState("barista");
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

      // Fetch both tabs
      const tabs = [
      { name: "barista", gids: ["0"] },
      { name: "cook", gids: ["129025812"] }];


      for (const tab of tabs) {
        let csvText = null;

        // Try each possible gid for this position
        for (const gid of tab.gids) {
          try {
            const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
            const response = await fetch(csvUrl);
            csvText = await response.text();
            if (csvText && csvText.length > 10) break; // Found valid data
          } catch {
            continue; // Try next gid
          }
        }

        if (!csvText) continue;

        try {
          const rows = parseCSV(csvText);
          if (rows.length < 2) continue;

          const headers = rows[0].map((h) => h.replace(/"/g, "").toLowerCase());
          const nameIndex = headers.findIndex((h) => h.includes("שם") || h.includes("name"));
          const phoneIndex = headers.findIndex((h) => h.includes("טלפון") || h.includes("phone") || h.includes("נייד") || h.includes("סלולר"));
          const timeIndex = headers.findIndex((h) => h.includes("זמן") || h.includes("time") || h.includes("תאריך") || h.includes("ביצוע"));
          const cityIndex = headers.findIndex((h) => h.includes("עיר") || h.includes("city") || h.includes("יישוב"));
          const ageIndex = headers.findIndex((h) => h.includes("גיל") || h.includes("age"));
          // Column C (index 2): "ניסיון?" (yes/no)
          const hasExperienceIndex = 2;
          // Column D (index 3): "תאור ניסיון" (experience description)
          const experienceDescIndex = 3;
          const availabilityIndex = headers.findIndex((h) => h.includes("זמינות") || h.includes("availability"));
          const notesIndex = headers.findIndex((h) => h.includes("הערות") || h.includes("notes") || h.includes("הערה"));

          if (nameIndex === -1 || phoneIndex === -1) continue;

          for (let i = 1; i < rows.length; i++) {
            const values = rows[i];
            const name = values[nameIndex]?.replace(/"/g, "").trim();
            let phone = values[phoneIndex]?.replace(/"/g, "").trim();

            console.log(`${tab.name} row ${i}:`, { name, phone, rawPhone: values[phoneIndex], allValues: values });

            if (!name || !phone) {
              console.log(`Skipping - name: ${name}, phone: ${phone}`);
              continue;
            }

            const cleanPhone = phone.replace(/\D/g, "");
            console.log(`cleanPhone: ${cleanPhone}, length: ${cleanPhone.length}`);
            if (!cleanPhone || cleanPhone.length < 9) {
              console.log(`Skipping - invalid phone length`);
              continue;
            }
            if (existingPhones.has(cleanPhone)) {
              console.log(`Skipping - phone exists`);
              continue;
            }

            console.log(`✓ Adding candidate: ${name}`);

            newCandidates.push({
              name,
              phone,
              position: tab.name,
              contact_time: timeIndex !== -1 ? values[timeIndex]?.trim().replace(/"/g, "") : "",
              city: cityIndex !== -1 ? values[cityIndex]?.trim().replace(/"/g, "") : "",
              age: ageIndex !== -1 ? values[ageIndex]?.trim().replace(/"/g, "") : "",
              has_experience: hasExperienceIndex !== -1 ? values[hasExperienceIndex]?.trim().replace(/"/g, "") : "",
              experience_description: experienceDescIndex !== -1 ? values[experienceDescIndex]?.trim().replace(/"/g, "") : "",
              availability: availabilityIndex !== -1 ? values[availabilityIndex]?.trim().replace(/"/g, "") : "",
              status: "not_handled",
              notes: notesIndex !== -1 ? values[notesIndex]?.trim().replace(/"/g, "") : "",
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

  const positionLabel = activePosition === "barista" ? "בריסטה" : "טבח";

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
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696259f154cc9f8fbcf36bd7/d56033b78_1.jpg"
              alt="גיוטליה לוגו"
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
          <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
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