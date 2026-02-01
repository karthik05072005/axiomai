# Google Sheets Integration Setup

## 1. Share Google Sheet with Service Account

Your Google Sheet needs to be shared with the service account email:
**Email:** `axiom-318@axiom-485809.iam.gserviceaccount.com`

### Steps:
1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1k4pRYDbUMix4Lecfu5tX1B-9JT1pmZweG05OK5lggd8/edit
2. Click **Share** button (top right)
3. Add the email: `axiom-318@axiom-485809.iam.gserviceaccount.com`
4. Give it **Viewer** access (or Editor if you want to allow modifications)
5. Click **Send**

## 2. Deploy Edge Function

The Edge Function has been updated to use your service account credentials. Now deploy it:

### Option A: Via Supabase Dashboard (Recommended)
1. Go to your Supabase dashboard: https://sefjfurthcwfkiiqyudu.supabase.co
2. Navigate to **Edge Functions**
3. Click **"New Function"** or update existing
4. Function name: `sync-google-sheets`
5. Copy the code from `supabase/functions/sync-google-sheets/index.ts`
6. Deploy

### Option B: Via CLI (if you have access)
```bash
npx supabase functions deploy sync-google-sheets
```

## 3. Test the Integration

Once deployed:
1. Go to your app: http://localhost:8080/
2. Navigate to **Leads** page
3. Click **"Sync from Sheets"** button
4. The function will:
   - Authenticate using your service account
   - Read data from your Google Sheet
   - Import new leads into the database
   - Skip already imported rows

## 4. Real-time Updates

For real-time updates, you can:
- Click "Sync from Sheets" manually when needed
- Set up a webhook from Google Apps Script to trigger automatic sync
- Use the existing sync button which will show real-time results

The integration is now secure and uses your service account credentials instead of a public API key!
