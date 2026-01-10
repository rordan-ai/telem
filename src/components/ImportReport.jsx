import React from "react";

export default function ImportReport({ report }) {
  if (!report) return null;

  const reasonLabels = {
    duplicate: "כפולים",
    missing_required: "חסר שם/טלפון",
    invalid_phone: "טלפון לא תקין",
    missing_required_columns: "חסרות עמודות חובה",
    fetch_failed: "כשל בקבלת הנתונים",
    no_data_rows: "ללא נתונים בגליון"
  };

  const totalReasons = report.total?.reasons || {};

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mt-2">
      <h3 className="text-slate-800 font-semibold mb-2">דוח ייבוא</h3>

      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-slate-500">יובאו בהצלחה</div>
          <div className="text-slate-900 font-bold">{report.total?.imported ?? 0}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-slate-500">לא יובאו</div>
          <div className="text-slate-900 font-bold">{report.total?.skipped ?? 0}</div>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-slate-600 text-sm font-medium mb-1">פירוט סיבות (סה"כ):</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(totalReasons).map(([key, val]) => (
            <span key={key} className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
              {reasonLabels[key] || key}: {val}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-slate-600 text-sm font-medium mb-2">פירוט לפי גליון:</div>
        <div className="space-y-2">
          {report.tabs?.map((t) => (
            <div key={t.name} className="border rounded-lg p-2 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-medium text-slate-800">{t.sheetName}</div>
                <div className="text-slate-500">שורות: {t.fetchedRows ?? 0}</div>
              </div>
              <div className="flex gap-3 mt-1 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">יובאו: {t.imported}</span>
                <span className="px-2 py-0.5 rounded bg-red-50 text-red-700">לא יובאו: {t.skipped}</span>
                {Object.entries(t.reasons || {}).map(([key, val]) => (
                  val > 0 ? (
                    <span key={key} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {reasonLabels[key] || key}: {val}
                    </span>
                  ) : null
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}