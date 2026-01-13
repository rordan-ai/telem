import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  console.log("🚀 Starting deleteAccountantCandidates...");
  
  try {
    const base44 = createClientFromRequest(req);
    
    // טעינת כל המועמדים של מנהלת חשבונות
    const candidates = await base44.asServiceRole.entities.Candidate.filter({
      position: "accountant_manager"
    });
    
    console.log(`📊 Found ${candidates.length} accountant_manager candidates to delete`);
    
    let deletedCount = 0;
    for (const candidate of candidates) {
      try {
        await base44.asServiceRole.entities.Candidate.delete(candidate.id);
        deletedCount++;
        console.log(`✅ Deleted: ${candidate.name}`);
      } catch (err) {
        console.log(`❌ Failed to delete ${candidate.name}:`, err.message);
      }
    }
    
    console.log(`🏁 Done! Deleted ${deletedCount} candidates`);
    
    return Response.json({
      success: true,
      deleted: deletedCount,
      message: `נמחקו ${deletedCount} מועמדים של מנהלת חשבונות`
    });
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});