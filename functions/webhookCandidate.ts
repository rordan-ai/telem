import { createClient } from 'npm:@base44/sdk@0.8.6';

// פונקציה לקבלת קורות חיים מ-Webhook (Make.com)
// מחפשת מועמד קיים לפי שם או אימייל ומעדכנת את קישור קורות החיים שלו
// כתובת ה-URL תמצא בלוח הבקרה: קוד -> פונקציות -> webhookCandidate

const VALID_API_KEY = "798bcce7985e43dfa0d3e1372dca4837";

Deno.serve(async (req) => {
  console.log("🚀 [WEBHOOK] Received request");
  
  // תמיכה ב-CORS עבור Make.com
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, api_key"
      }
    });
  }

  try {
    // בדיקת API key
    const apiKey = req.headers.get("api_key") || req.headers.get("Api-Key") || req.headers.get("API_KEY");
    console.log("🔑 [WEBHOOK] Received API key:", apiKey ? "present" : "missing");
    
    if (apiKey !== VALID_API_KEY) {
      return Response.json({ 
        success: false, 
        error: "Invalid or missing API key" 
      }, { 
        status: 401,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    // יצירת קליינט עם service role
    const base44 = createClient({ 
      appId: Deno.env.get("BASE44_APP_ID"),
      serviceRoleKey: Deno.env.get("BASE44_SERVICE_ROLE_KEY")
    });
    
    // קבלת הנתונים מהבקשה
    const data = await req.json();
    console.log("📋 [WEBHOOK] Received data:", JSON.stringify(data));

    // שליפת הנתונים - מותאם ל-Make.com
    const name = (data.candidate_name || data.name || '').trim();
    const jobTitle = (data.job_title || '').trim();
    const cvUrl = data.cv_url || '';

    console.log(`📋 [WEBHOOK] Parsed: name="${name}", job_title="${jobTitle}", cv_url="${cvUrl}"`);

    if (!name) {
      return Response.json({ 
        success: false, 
        error: "Missing required field: candidate_name" 
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
    const allCandidates = await base44.entities.Candidate.list();
    
    // חיפוש מועמד לפי שם או אימייל
    let foundCandidate = null;
    
    const searchName = name.toLowerCase();
    
    for (const candidate of allCandidates) {
      const candidateName = (candidate.name || '').trim().toLowerCase();
      
      // התאמה לפי שם (התאמה מלאה או חלקית)
      if (candidateName === searchName || candidateName.includes(searchName) || searchName.includes(candidateName)) {
        foundCandidate = candidate;
        console.log(`✅ [WEBHOOK] Found by name: ${candidate.name}`);
        break;
      }
    }

    if (!foundCandidate) {
      console.log(`⚠️ [WEBHOOK] No candidate found for name="${name}"`);
      return Response.json({
        success: false,
        error: "לא נמצא מועמד תואם",
        searchedName: name,
        searchedJobTitle: jobTitle
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