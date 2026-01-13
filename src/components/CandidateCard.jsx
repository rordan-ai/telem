import React, { useState } from "react";
import { motion } from "framer-motion";
import { Phone, MessageCircle, ChevronDown, User, MapPin, Clock, Briefcase, Calendar, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from
"@/components/ui/alert-dialog";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

const statusOptions = [
{ value: "not_handled", label: "לא טופל", color: "bg-slate-100 text-slate-600 border-slate-200" },
{ value: "message_sent", label: "נשלחה הודעה", color: "bg-amber-50 text-amber-700 border-amber-200" },
{ value: "relevant", label: "רלוונטי", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
{ value: "not_relevant", label: "לא רלוונטי", color: "bg-red-50 text-red-700 border-red-200" }];


export default function CandidateCard({ candidate, onUpdate }) {
  const [notes, setNotes] = useState(candidate.notes || "");
  const [status, setStatus] = useState(candidate.status || "not_handled");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteSource, setDeleteSource] = useState(null); // 'trash' or 'status'

  const currentStatus = statusOptions.find((s) => s.value === status);

  const formatPhoneForWhatsApp = (phone) => {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
      cleaned = "972" + cleaned.slice(1);
    }
    return cleaned;
  };

  const handleStatusChange = async (newStatus) => {
    if (newStatus === "not_relevant") {
      setDeleteSource('status');
      setShowDeleteDialog(true);
      return;
    }
    setStatus(newStatus);
    setIsSaving(true);
    await base44.entities.Candidate.update(candidate.id, { status: newStatus });
    setIsSaving(false);
    onUpdate?.();
  };

  const handleDelete = async () => {
    await base44.entities.Candidate.update(candidate.id, { is_deleted_by_app: true });
    setShowDeleteDialog(false);
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
      className="bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow duration-300">

      <div className="bg-slate-900 p-4 relative">
        {/* CV Icon - Absolute positioned top right */}
                      {candidate.cv_url && (
                        <a
                          href={candidate.cv_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 100 }}
                          className="hover:opacity-80 transition-opacity block text-center"
                          title="צפה בקורות חיים">
                          <img
                            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69627124175a0ec7a8b42b8e/b434f37ac_resume.png"
                            alt="קורות חיים"
                            style={{ width: '36px', height: '36px', display: 'block' }}
                          />
                          <span className="text-[10px] text-white mt-0.5 block">קו"ח</span>
                        </a>
                      )}
        
        {/* Header Row */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setDeleteSource('trash');
                setShowDeleteDialog(true);
              }}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-colors"
              title="מחק מועמד">
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          </div>
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
                <span className="text-slate-50 text-xs flex items-center gap-1">
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
                <span className="text-slate-50 text-sm flex items-center gap-1">
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
                    <span className={`w-2 h-2 rounded-full ${option.value === 'not_handled' ? 'bg-slate-400' : option.value === 'message_sent' ? 'bg-amber-500' : option.value === 'relevant' ? 'bg-emerald-500' : 'bg-red-500'}`} />
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
            className="w-full rounded-xl border-slate-200 resize-none text-sm min-h-[60px] focus:border-slate-300 focus:ring-slate-300 pr-3 pl-10 text-white"
            dir="rtl" />
          {notes !== candidate.notes && notes.length > 0 &&
          <button
            onClick={handleNotesBlur}
            className="absolute top-2 left-2 w-6 h-6 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center transition-colors"
            title="שמור הערה">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          }
        </div>


        {/* Expandable Details */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-sm text-slate-500 hover:text-slate-700 transition-colors py-2">

          <span className="text-slate-50">פרטים נוספים</span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}>

            <ChevronDown className="text-zinc-50 lucide lucide-chevron-down w-4 h-4" />
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

          <div className="text-slate-50 pt-2 pb-1 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-slate-400 font-semibold min-w-[80px]">מודעה:</span>
              <span className="text-slate-200">{candidate.branch || '-'}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-slate-400 font-semibold min-w-[80px]">אימייל:</span>
              {candidate.email ? <a href={`mailto:${candidate.email}`} className="text-blue-400 hover:underline break-all">{candidate.email}</a> : <span className="text-slate-200">-</span>}
            </div>
            <div className="flex items-start gap-2">
              <span className="text-slate-400 font-semibold min-w-[80px]">ישוב מגורים:</span>
              <span className="text-slate-200">{candidate.city || '-'}</span>
            </div>

            {candidate.position === 'climbing_wall' && (
              <>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[120px]">ניסיון הדרכה:</span>
                  <span className="text-slate-200">{candidate.instruction_experience || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[120px]">פירוט ניסיון הדרכה:</span>
                  <span className="text-slate-200">{candidate.instruction_experience_details || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[120px]">ניסיון פעילות פיזית/מתקנים:</span>
                  <span className="text-slate-200">{candidate.physical_activity_experience || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[120px]">פירוט ניסיון פעילות פיזית:</span>
                  <span className="text-slate-200">{candidate.physical_activity_details || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[120px]">התאמת שעות עבודה:</span>
                  <span className="text-slate-200">{candidate.work_hours_availability || '-'}</span>
                </div>
              </>
            )}

            {candidate.position !== 'climbing_wall' && candidate.position !== 'manager_commerce' && candidate.position !== 'accountant_manager' && (
              <>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[80px]">תאריך פניה:</span>
                  <span className="text-slate-200">{candidate.contact_time || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[80px]">קמפיין:</span>
                  <span className="text-slate-200">{candidate.campaign || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[80px]">האם יש ניסיון:</span>
                  <span className="text-slate-200">{candidate.has_experience || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[80px]">מועמד למשרה:</span>
                  <span className="text-slate-200">{candidate.job_title || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[80px]">תאור ניסיון:</span>
                  <span className="text-slate-200">{candidate.experience_description || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[80px]">עובד כרגע:</span>
                  <span className="text-slate-200">{candidate.currently_working || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[80px]">רכב/ניידות:</span>
                  <span className="text-slate-200">{candidate.transportation || '-'}</span>
                </div>
              </>
            )}

            {candidate.position === 'accountant_manager' && (
                <>
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 font-semibold min-w-[80px]">תאריך פניה:</span>
                    <span className="text-slate-200">{candidate.contact_time || '-'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 font-semibold min-w-[120px]">תעודת מנהלת חשבונות:</span>
                    <span className="text-slate-200">{candidate.accountant_certificate || '-'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 font-semibold min-w-[120px]">ניסיון בסיסי באקסל:</span>
                    <span className="text-slate-200">{candidate.accountant_excel_experience || '-'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 font-semibold min-w-[120px]">ניסיון בסיסי בקומקס:</span>
                    <span className="text-slate-200">{candidate.accountant_comax_experience || '-'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 font-semibold min-w-[120px]">ניסיון בתפקיד:</span>
                    <span className="text-slate-200">{candidate.accountant_role_experience || '-'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 font-semibold min-w-[80px]">עיר מגורים:</span>
                    <span className="text-slate-200">{candidate.city || '-'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 font-semibold min-w-[80px]">אימייל:</span>
                    {candidate.email ? <a href={`mailto:${candidate.email}`} className="text-blue-400 hover:underline break-all">{candidate.email}</a> : <span className="text-slate-200">-</span>}
                  </div>
                </>
              )}

            {candidate.position === 'manager_commerce' && (
              <>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[80px]">תאריך פניה:</span>
                  <span className="text-slate-200">{candidate.contact_time || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[80px]">קמפיין:</span>
                  <span className="text-slate-200">{candidate.campaign || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[80px]">ניסיון בסחר/ניהול קטגוריות:</span>
                  <span className="text-slate-200">{candidate.commerce_experience || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[80px]">שליטה בקומקס:</span>
                  <span className="text-slate-200">{candidate.comax_proficiency || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[80px]">בניית פלנוגרמות ונראות מדף:</span>
                  <span className="text-slate-200">{candidate.planogram_skills || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[80px]">ניהול מו"מ מול ספקים:</span>
                  <span className="text-slate-200">{candidate.supplier_negotiation || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[80px]">ניתוח דוח רווח והפסד:</span>
                  <span className="text-slate-200">{candidate.pnl_analysis || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold min-w-[80px]">זמינות:</span>
                  <span className="text-slate-200">{candidate.availability || '-'}</span>
                </div>
              </>
            )}
            </div>
        </motion.div>

        {isSaving &&
        <div className="text-xs text-slate-400 mt-2 text-center">שומר...</div>
        }
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>האם למחוק?</AlertDialogTitle>
            <AlertDialogDescription className="text-red-600 font-medium">
              האם הנך בטוח במחיקה?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2">
            <AlertDialogCancel>לא</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              כן
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>);

}