import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// פונקציה לקבלת קורות חיים מ-Webhook (Make.com)
// מחפשת מועמד קיים לפי שם או אימייל ומעדכנת את קישור קורות החיים שלו
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

    // שליפת הנתונים
    const name = (data.name || data.full_name || '').trim();
    const email = (data.email || '').trim().toLowerCase();
    const cvUrl = data.cv_url || data.cvUrl || data.resume_url || data.resumeUrl || '';

    if (!name && !email) {
      return Response.json({ 
        success: false, 
        error: "Missing required field: name or email" 
      }, { status: 400 });
    }

    if (!cvUrl) {
      return Response.json({ 
        success: false, 
        error: "Missing required field: cv_url" 
      }, { status: 400 });
    }

    // טעינת כל המועמדים
    console.log("🔍 [WEBHOOK] Searching for candidate...");
    const allCandidates = await base44.asServiceRole.entities.Candidate.list();
    
    // חיפוש מועמד לפי שם או אימייל
    let foundCandidate = null;
    
    for (const candidate of allCandidates) {
      const candidateName = (candidate.name || '').trim().toLowerCase();
      const candidateEmail = (candidate.email || '').trim().toLowerCase();
      
      // התאמה לפי אימייל (עדיפות ראשונה)
      if (email && candidateEmail && candidateEmail === email) {
        foundCandidate = candidate;
        console.log(`✅ [WEBHOOK] Found by email: ${candidate.name}`);
        break;
      }
      
      // התאמה לפי שם (התאמה מלאה או חלקית)
      if (name && candidateName) {
        const searchName = name.toLowerCase();
        if (candidateName === searchName || candidateName.includes(searchName) || searchName.includes(candidateName)) {
          foundCandidate = candidate;
          console.log(`✅ [WEBHOOK] Found by name: ${candidate.name}`);
          break;
        }
      }
    }

    if (!foundCandidate) {
      console.log(`⚠️ [WEBHOOK] No candidate found for name="${name}", email="${email}"`);
      return Response.json({
        success: false,
        error: "לא נמצא מועמד תואם",
        searchedName: name,
        searchedEmail: email
      }, { 
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    // עדכון קורות החיים למועמד שנמצא
    console.log(`📝 [WEBHOOK] Updating cv_url for ${foundCandidate.name} (${foundCandidate.id})`);
    await base44.asServiceRole.entities.Candidate.update(foundCandidate.id, {
      cv_url: cvUrl
    });
    
    console.log("✅ [WEBHOOK] CV updated successfully");

    return Response.json({
      success: true,
      message: "קורות חיים עודכנו בהצלחה",
      candidateId: foundCandidate.id,
      candidateName: foundCandidate.name,
      position: foundCandidate.position
    }, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });

  } catch (error) {
    console.error("❌ [WEBHOOK] Error:", error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { 
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
});