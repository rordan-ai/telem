import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// פונקציה לקבלת מועמדים מ-Webhook (Make.com)
// כתובת ה-URL תמצא בלוח הבקרה: קוד -> פונקציות -> webhookCandidate

Deno.serve(async (req) => {
  console.log("🚀 [WEBHOOK] Received request");
  
  // תמיכה ב-CORS עבור Make.com
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    
    // קבלת הנתונים מהבקשה
    const data = await req.json();
    console.log("📋 [WEBHOOK] Received data:", JSON.stringify(data));

    // וולידציה בסיסית
    const name = data.name || data.full_name || '';
    const email = data.email || '';
    const phone = data.phone || data.telephone || '';
    const cvUrl = data.cv_url || data.cvUrl || data.resume_url || data.resumeUrl || '';

    if (!name) {
      return Response.json({ 
        success: false, 
        error: "Missing required field: name" 
      }, { status: 400 });
    }

    // יצירת מועמד חדש
    const candidateData = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      cv_url: cvUrl,
      position: "website_cv",
      status: "not_handled",
      is_deleted_by_app: false,
      contact_time: new Date().toISOString(),
      notes: data.notes || data.message || ''
    };

    console.log("📝 [WEBHOOK] Creating candidate:", JSON.stringify(candidateData));
    
    const created = await base44.asServiceRole.entities.Candidate.create(candidateData);
    
    console.log("✅ [WEBHOOK] Candidate created successfully:", created.id);

    return Response.json({
      success: true,
      message: "מועמד נוסף בהצלחה",
      candidateId: created.id
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    console.error("❌ [WEBHOOK] Error:", error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { 
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
});