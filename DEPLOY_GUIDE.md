# Deploy Edge Function - Step by Step Guide

## Method 1: Via Supabase Dashboard (Easiest)

### Step 1: Access Supabase Dashboard
1. Go to: https://sefjfurthcwfkiiqyudu.supabase.co
2. Sign in with your account

### Step 2: Navigate to Edge Functions
1. On the left sidebar, click **"Edge Functions"**
2. You might see existing functions or an empty list

### Step 3: Create/Update Function
**If function doesn't exist:**
1. Click **"New Function"** button
2. Function name: `sync-google-sheets`
3. Click **"Create"**

**If function already exists:**
1. Find `sync-google-sheets` in the list
2. Click the **three dots (⋯)** next to it
3. Select **"Edit"** or **"Update"**

### Step 4: Copy the Code
1. Open the file: `supabase/functions/sync-google-sheets/index.ts`
2. Copy all the code (Ctrl+A, Ctrl+C)

### Step 5: Paste and Deploy
1. In the Supabase dashboard editor, paste the code
2. Click **"Save"** or **"Deploy"** button
3. Wait for deployment to complete (usually 30-60 seconds)

### Step 6: Verify Deployment
1. You should see a green checkmark or "Deployed" status
2. The function URL will be shown (something like: `https://sefjfurthcwfkiiqyudu.supabase.co/functions/v1/sync-google-sheets`)

## Method 2: Using Supabase CLI (Advanced)

If you prefer command line:

### Install Supabase CLI
```bash
# Using npm
npm install -g supabase

# Or using other package managers
# bun install -g supabase
# yarn global add supabase
```

### Login to Supabase
```bash
supabase login
```

### Link to your project
```bash
supabase link --project-ref sefjfurthcwfkiiqyudu
```

### Deploy the function
```bash
supabase functions deploy sync-google-sheets
```

## Troubleshooting

### If you get errors:
1. **"Function not found"**: Create the function first (Method 1, Step 3)
2. **"Permission denied"**: Make sure you're logged in to the right account
3. **"Deployment failed"**: Check the code syntax and try again

### Check Function Status:
1. Go to Edge Functions in dashboard
2. Look for green status indicators
3. Click on function name to see logs

## After Deployment

Once deployed, test it:
1. Go to your app: http://localhost:8080/
2. Navigate to **Leads** page
3. Click **"Sync from Sheets"** button
4. Check browser console for any errors

The function should now work with your Google Service Account!
