import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { cv_url } = await req.json();
    
    if (!cv_url) {
      return Response.json({ error: 'Missing cv_url parameter' }, { status: 400 });
    }

    // Fetch the file from Supabase
    const fileResponse = await fetch(cv_url);
    
    if (!fileResponse.ok) {
      return Response.json({ error: 'Failed to fetch file' }, { status: 502 });
    }

    // Get the file content
    const fileBuffer = await fileResponse.arrayBuffer();
    
    // Determine content type from URL
    let contentType = 'application/octet-stream';
    const urlLower = cv_url.toLowerCase();
    
    if (urlLower.includes('.pdf')) {
      contentType = 'application/pdf';
    } else if (urlLower.includes('.docx')) {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (urlLower.includes('.doc')) {
      contentType = 'application/msword';
    }

    // Extract filename from URL
    const urlPath = cv_url.split('?')[0];
    const filename = urlPath.split('/').pop() || 'cv';

    // Return the file with inline disposition to force browser to display it
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Error in viewCV:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});