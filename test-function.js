// Test script to call the Edge Function directly
const testFunction = async () => {
  try {
    const response = await fetch('https://sefjfurthcwfkiiqyudu.supabase.co/functions/v1/google_sheets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE', // You'll need to get this from browser
      },
      body: JSON.stringify({})
    });

    const result = await response.json();
    console.log('Response:', result);
    console.log('Status:', response.status);
  } catch (error) {
    console.error('Error:', error);
  }
};

// Instructions:
// 1. Open browser dev tools (F12)
// 2. Go to your app: http://localhost:8080/
// 3. Log in to get JWT token
// 4. In console, run: localStorage.getItem('supabase.auth.token')
// 5. Copy the access_token from the result
// 6. Replace YOUR_JWT_TOKEN_HERE with the actual token
// 7. Run this script in console
