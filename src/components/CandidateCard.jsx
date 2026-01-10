import React, { useState } from "react";
import { motion } from "framer-motion";
import { Phone, MessageCircle, ChevronDown, User, MapPin, Clock, Briefcase, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

const statusOptions = [
{ value: "not_handled", label: "לא טופל", color: "bg-slate-100 text-slate-600 border-slate-200" },
{ value: "message_sent", label: "נשלחה הודעה", color: "bg-amber-50 text-amber-700 border-amber-200" },
{ value: "relevant", label: "רלוונטי", color: "bg-emerald-50 text-emerald-700 border-emerald-200" }];


export default function CandidateCard({ candidate, onUpdate }) {
  const [notes, setNotes] = useState(candidate.notes || "");
  const [status, setStatus] = useState(candidate.status || "not_handled");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentStatus = statusOptions.find((s) => s.value === status);

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

  const formatContactTime = (timeStr) => {
    if (!timeStr) return "";
    try {
      const date = new Date(timeStr);
      return format(date, "dd/MM HH:mm");
    } catch {
      return timeStr;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow duration-300">

      <div className="bg-slate-900 p-4">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-gray-50 flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-slate-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-slate-50 flex items-center gap-2 flex-wrap">
                <h3 className="text-slate-50 text-base font-semibold">
                  {candidate.name}
                </h3>
                {candidate.contact_time &&
                <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatContactTime(candidate.contact_time)}
                  </span>
                }
              </div>
              <div className="flex items-center gap-3 flex-wrap mt-1">
                <a
                  href={`tel:${candidate.phone}`} className="text-slate-50 text-sm hover:text-slate-700 transition-colors"

                  dir="ltr">

                  {candidate.phone}
                </a>
                {candidate.city &&
                <span className="text-sm text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {candidate.city}
                  </span>
                }
              </div>
            </div>
          </div>
          
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0">

            <Button
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-4 h-12 shadow-sm">

              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696259f154cc9f8fbcf36bd7/fafb8b988_.png"
                alt="WhatsApp"
                className="w-8 h-8" />

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
              {statusOptions.map((option) =>
              <SelectItem key={option.value} value={option.value}>
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${option.value === 'not_handled' ? 'bg-slate-400' : option.value === 'message_sent' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    {option.label}
                  </span>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Notes Input with Save Button */}
        <div className="relative mb-3">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="הוסף הערות..."
            className="w-full rounded-xl border-slate-200 resize-none text-sm min-h-[60px] focus:border-slate-300 focus:ring-slate-300 pr-3 pl-10"
            dir="rtl" />
          <button
            onClick={handleNotesBlur}
            className="absolute top-2 left-2 w-6 h-6 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center transition-colors"
            title="שמור הערה">

            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>


        {/* Expandable Details */}
        {(candidate.age || candidate.has_experience || candidate.experience_description || candidate.availability) &&
        <>
            <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between text-sm text-slate-500 hover:text-slate-700 transition-colors py-2">

              <span>פרטים נוספים</span>
              <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}>

                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </button>

            <motion.div
            initial={false}
            animate={{
              height: isExpanded ? "auto" : 0,
              opacity: isExpanded ? 1 : 0
            }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden">

              <div className="text-slate-50 pt-2 pb-1 space-y-2">
                {candidate.age &&
              <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-500">גיל:</span>
                    <span className="text-slate-700">{candidate.age}</span>
                  </div>
              }
                {candidate.has_experience &&
              <div className="text-slate-50 text-sm flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-50">ניסיון:</span>
                    <span className="text-slate-50">{candidate.has_experience}</span>
                  </div>
              }
                {candidate.experience_description &&
              <div className="flex items-start gap-2 text-sm">
                    <Briefcase className="w-4 h-4 text-slate-400 mt-0.5" />
                    <span className="text-slate-50">תאור ניסיון:</span>
                    <span className="text-slate-50">{candidate.experience_description}</span>
                  </div>
              }
                {candidate.availability &&
              <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-500">זמינות:</span>
                    <span className="text-slate-700">{candidate.availability}</span>
                  </div>
              }
              </div>
            </motion.div>
          </>
        }

        {isSaving &&
        <div className="text-xs text-slate-400 mt-2 text-center">שומר...</div>
        }
      </div>
    </motion.div>);

}