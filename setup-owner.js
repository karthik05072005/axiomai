import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sefjfurthcwfkiiqyudu.supabase.co';
const supabaseServiceKey = 'your-service-role-key-here'; // You need to get this from Supabase dashboard

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createOwnerUser() {
  try {
    // Create the user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'owner@gmail.com',
      password: 'owner123',
      email_confirm: true
    });

    if (authError) {
      console.error('Error creating user:', authError);
      return;
    }

    console.log('User created successfully:', authData.user?.id);

    // The user_roles and business_settings will be automatically created by the trigger
    console.log('Owner user setup complete!');

  } catch (error) {
    console.error('Error:', error);
  }
}

createOwnerUser();
