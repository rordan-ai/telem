import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download } from "lucide-react";
import { base44 } from "@/api/base44Client";

const SHEET_ID = "1GQvdNPj_kAgpMQjveUGpMxQI0E3AtAP9bXXA6J2Mm1o";

export default function ImportFromSheet({ onImportComplete }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAndImport = async () => {
    setIsLoading(true);
    setError(null);

    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

    const response = await fetch(csvUrl);
    const csvText = await response.text();

    const lines = csvText.split("\n").filter(line => line.trim());
    if (lines.length < 2) {
      setError("הגיליון ריק");
      setIsLoading(false);
      return;
    }

    // Parse CSV - assuming columns: name, phone, position
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const nameIndex = headers.findIndex(h => h.includes("שם") || h.includes("name"));
    const phoneIndex = headers.findIndex(h => h.includes("טלפון") || h.includes("phone") || h.includes("נייד"));
    const positionIndex = headers.findIndex(h => h.includes("תפקיד") || h.includes("position") || h.includes("משרה"));

    if (nameIndex === -1 || phoneIndex === -1) {
      setError("לא נמצאו עמודות שם וטלפון בגיליון");
      setIsLoading(false);
      return;
    }

    // Get existing candidates to avoid duplicates
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

      // Determine position
      let positionValue = "barista"; // default
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
    }

    setIsLoading(false);
    onImportComplete?.(newCandidates.length);
  };

  // Helper to parse CSV line (handles quoted values)
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

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={fetchAndImport}
        disabled={isLoading}
        variant="outline"
        className="rounded-xl border-slate-200 hover:bg-slate-50"
      >
        {isLoading ? (
          <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
        ) : (
          <Download className="w-4 h-4 ml-2" />
        )}
        {isLoading ? "מייבא..." : "ייבוא מגוגל שיטס"}
      </Button>
      {error && (
        <p className="text-red-500 text-sm text-center">{error}</p>
      )}
    </div>
  );
}