import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Loader2 } from "lucide-react";
import CandidateCard from "@/components/CandidateCard";
import PositionTabs from "@/components/PositionTabs";
import ImportFromSheet from "@/components/ImportFromSheet";

export default function Recruitment() {
  const [activePosition, setActivePosition] = useState("barista");
  const [importMessage, setImportMessage] = useState(null);
  const queryClient = useQueryClient();

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => base44.entities.Candidate.list("-created_date"),
  });

  const filteredCandidates = candidates.filter(
    (c) => c.position === activePosition
  );

  const handleImportComplete = (count) => {
    if (count > 0) {
      setImportMessage(`יובאו ${count} מועמדים חדשים`);
    } else {
      setImportMessage("לא נמצאו מועמדים חדשים לייבוא");
    }
    queryClient.invalidateQueries({ queryKey: ["candidates"] });
    setTimeout(() => setImportMessage(null), 3000);
  };

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
        {/* Import Button */}
        <div className="mb-6">
          <ImportFromSheet onImportComplete={handleImportComplete} />
          {importMessage && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-emerald-600 text-center mt-2 font-medium"
            >
              {importMessage}
            </motion.p>
          )}
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