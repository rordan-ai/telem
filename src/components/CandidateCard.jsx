import React, { useState } from "react";
import { motion } from "framer-motion";
import { Phone, MessageCircle, ChevronDown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

const statusOptions = [
  { value: "not_handled", label: "לא טופל", color: "bg-slate-100 text-slate-600 border-slate-200" },
  { value: "message_sent", label: "נשלחה הודעה", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "relevant", label: "רלוונטי", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
];

export default function CandidateCard({ candidate, onUpdate }) {
  const [notes, setNotes] = useState(candidate.notes || "");
  const [status, setStatus] = useState(candidate.status || "not_handled");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentStatus = statusOptions.find(s => s.value === status);

  const formatPhoneForWhatsApp = (phone) => {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
      cleaned = "972" + cleaned.slice(1);
    }
    return cleaned;
  };

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    setIsSaving(true);
    await base44.entities.Candidate.update(candidate.id, { status: newStatus });
    setIsSaving(false);
    onUpdate?.();
  };

  const handleNotesBlur = async () => {
    if (notes !== candidate.notes) {
      setIsSaving(true);
      await base44.entities.Candidate.update(candidate.id, { notes });
      setIsSaving(false);
      onUpdate?.();
    }
  };

  const whatsappUrl = `https://wa.me/${formatPhoneForWhatsApp(candidate.phone)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow duration-300"
    >
      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-slate-500" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-slate-800 truncate text-base">
                {candidate.name}
              </h3>
              <a
                href={`tel:${candidate.phone}`}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                dir="ltr"
              >
                {candidate.phone}
              </a>
            </div>
          </div>
          
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0"
          >
            <Button
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-3 h-10 shadow-sm"
            >
              <MessageCircle className="w-4 h-4 ml-1" />
              <span className="hidden sm:inline">WhatsApp</span>
            </Button>
          </a>
        </div>

        {/* Status Row */}
        <div className="flex items-center gap-2 mb-3">
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className={`w-full rounded-xl border-2 h-10 ${currentStatus?.color}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${option.value === 'not_handled' ? 'bg-slate-400' : option.value === 'message_sent' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    {option.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Expandable Notes */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-sm text-slate-500 hover:text-slate-700 transition-colors py-2"
        >
          <span>הערות</span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </button>

        <motion.div
          initial={false}
          animate={{
            height: isExpanded ? "auto" : 0,
            opacity: isExpanded ? 1 : 0,
          }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="הוסף הערות..."
            className="w-full rounded-xl border-slate-200 resize-none text-sm min-h-[80px] focus:border-slate-300 focus:ring-slate-300"
            dir="rtl"
          />
        </motion.div>

        {isSaving && (
          <div className="text-xs text-slate-400 mt-2 text-center">שומר...</div>
        )}
      </div>
    </motion.div>
  );
}