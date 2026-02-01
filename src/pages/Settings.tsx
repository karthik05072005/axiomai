import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { BusinessSettings } from '@/types/crm';
import { toast } from 'sonner';
import { RefreshCw, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function Settings() {
  const [syncing, setSyncing] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['business-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data as BusinessSettings | null;
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<BusinessSettings>) => {
      if (settings?.id) {
        const { error } = await supabase
          .from('business_settings')
          .update(updates)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('business_settings')
          .insert({ ...updates, user_id: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-settings'] });
      toast.success('Settings saved successfully');
    },
    onError: (error) => {
      toast.error('Failed to save settings: ' + error.message);
    },
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      // 1️⃣ Fetch from Google Sheet via SheetDB
      const response = await fetch("https://sheetdb.io/api/v1/xwraoa0tt1kgq");
      const sheetLeads = await response.json();

      if (!sheetLeads || sheetLeads.length === 0) {
        toast.error("No leads found in WhatsApp");
        return;
      }

      // 2️⃣ Convert Sheet rows → CRM format
      const formattedLeads = sheetLeads.map((row: any) => ({
        user_id: user?.id || '',
        full_name: row["Business_Name"] || "",
        phone: row["WhatsApp_ID"] || "",
        service_interested: row["Current_Service"] || "",
        address: row["Address"] || "",
        lead_source: "google_sheet",
        status: row["Status"]?.toLowerCase() === "new user" ? "new" : 
                row["Status"]?.toLowerCase() === "complete" ? "converted" :
                row["Status"]?.toLowerCase() === "incomplete" ? "qualified" : "new",
        follow_up_date: null,
        google_sheet_row_id: null,
        notes: null,
        status_response: row["Status Response"] || null
      }));

      // 3️⃣ Remove duplicates based on phone number
      const { data: existingLeads, error: fetchError } = await supabase
        .from("leads")
        .select("phone");

      if (fetchError) throw fetchError;

      const existingPhones = new Set(existingLeads?.map(l => l.phone) || []);

      const newLeads = formattedLeads.filter(lead => 
        lead.full_name && lead.phone && !existingPhones.has(lead.phone)
      );

      if (newLeads.length === 0) {
        toast.info("No new leads to add");
        return;
      }

      // 4️⃣ Insert new leads into database
      const { error: insertError } = await supabase
        .from("leads")
        .insert(newLeads);

      if (insertError) throw insertError;

      toast.success(`${newLeads.length} new leads synced from WhatsApp successfully!`);
      
      // Refresh UI list
      queryClient.invalidateQueries({ queryKey: ['leads'] });

    } catch (error: any) {
      console.error("FULL SYNC ERROR:", error);
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
      alert(error.message || "Failed to sync leads");
      toast.error("Failed to sync leads: " + (error.message || "Unknown error"));
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateSettingsMutation.mutate({
      business_name: formData.get('business_name') as string,
      address: formData.get('address') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      tax_id: formData.get('tax_id') as string,
      // Keep google_sheet_id for internal use but don't expose it
      google_sheet_id: settings?.google_sheet_id || '',
    });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your business and integration settings</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business Information */}
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>
                This information will appear on your invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="business_name">Business Name</Label>
                <Input
                  id="business_name"
                  name="business_name"
                  defaultValue={settings?.business_name || 'AXIOM AI'}
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  defaultValue={settings?.address || ''}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    defaultValue={settings?.phone || ''}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={settings?.email || ''}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="tax_id">Tax/GST ID (Optional)</Label>
                <Input
                  id="tax_id"
                  name="tax_id"
                  defaultValue={settings?.tax_id || ''}
                />
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp Integration */}
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Integration</CardTitle>
              <CardDescription>
                Connect your WhatsApp to automatically import leads
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="google_sheet_id">WhatsApp API Key</Label>
                <Input
                  id="google_sheet_id"
                  name="google_sheet_id"
                  defaultValue={settings?.google_sheet_id || ''}
                  placeholder="Enter your WhatsApp API key"
                  type="password"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Your WhatsApp API key for importing leads automatically
                </p>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Manual Sync</p>
                  <p className="text-sm text-muted-foreground">
                    Pull latest leads from your WhatsApp
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={handleSync} disabled={syncing}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button type="submit" className="w-full">
            <Save className="mr-2 h-4 w-4" />
            Save Settings
          </Button>
        </form>
      </div>
    </MainLayout>
  );
}