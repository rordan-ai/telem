import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Loader2, RefreshCw } from "lucide-react";
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
    queryFn: () => base44.entities.Candidate.list("-created_date"),
  });

  const filteredCandidates = candidates.filter(
    (c) => c.position === activePosition
  );

  // Helper to parse CSV line
  const parseCSVLine = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const fetchAndImport = async () => {
    setIsImporting(true);
    
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
      const response = await fetch(csvUrl);
      const csvText = await response.text();

      const lines = csvText.split("\n").filter(line => line.trim());
      if (lines.length < 2) {
        setIsImporting(false);
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const nameIndex = headers.findIndex(h => h.includes("שם") || h.includes("name"));
      const phoneIndex = headers.findIndex(h => h.includes("טלפון") || h.includes("phone") || h.includes("נייד"));
      const positionIndex = headers.findIndex(h => h.includes("תפקיד") || h.includes("position") || h.includes("משרה"));

      if (nameIndex === -1 || phoneIndex === -1) {
        setIsImporting(false);
        return;
      }

      const existingCandidates = await base44.entities.Candidate.list();
      const existingPhones = new Set(existingCandidates.map(c => c.phone.replace(/\D/g, "")));

      const newCandidates = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const name = values[nameIndex]?.trim();
        const phone = values[phoneIndex]?.trim();
        let position = values[positionIndex]?.trim().toLowerCase() || "";

        if (!name || !phone) continue;

        const cleanPhone = phone.replace(/\D/g, "");
        if (existingPhones.has(cleanPhone)) continue;

        let positionValue = "barista";
        if (position.includes("טבח") || position.includes("cook") || position.includes("מטבח")) {
          positionValue = "cook";
        }

        newCandidates.push({
          name,
          phone,
          position: positionValue,
          status: "not_handled",
          notes: "",
          sheet_row_id: `row_${i}`,
        });
        
        existingPhones.add(cleanPhone);
      }

      if (newCandidates.length > 0) {
        await base44.entities.Candidate.bulkCreate(newCandidates);
        setImportMessage(`נוספו ${newCandidates.length} מועמדים חדשים`);
        setTimeout(() => setImportMessage(null), 4000);
        queryClient.invalidateQueries({ queryKey: ["candidates"] });
      }
    } catch (error) {
      console.error("Import error:", error);
    }
    
    setIsImporting(false);
  };

  // Auto-import on load and every 5 minutes
  useEffect(() => {
    fetchAndImport();
    const interval = setInterval(fetchAndImport, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["candidates"] });
  };

  const positionLabel = activePosition === "barista" ? "בריסטה" : "טבח";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800">גיוס מועמדים</h1>
              <p className="text-sm text-slate-500">ניהול מועמדים לתפקידים</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
          </div>
          
          <PositionTabs
            activePosition={activePosition}
            onPositionChange={setActivePosition}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Auto-sync indicator */}
        {(isImporting || importMessage) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100"
          >
            <div className="flex items-center justify-center gap-2 text-sm text-emerald-700">
              {isImporting && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span className="font-medium">
                {isImporting ? "מסנכרן עם גוגל שיטס..." : importMessage}
              </span>
            </div>
          </motion.div>
        )}

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
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          </div>
        ) : filteredCandidates.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium">אין מועמדים ל{positionLabel}</p>
            <p className="text-slate-400 text-sm mt-1">
              לחץ על "ייבוא מגוגל שיטס" להוספת מועמדים
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredCandidates.map((candidate, index) => (
                <motion.div
                  key={candidate.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <CandidateCard
                    candidate={candidate}
                    onUpdate={handleUpdate}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}