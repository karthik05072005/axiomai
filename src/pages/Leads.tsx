import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Plus,
  RefreshCw,
  UserPlus,
  MessageSquare,
  UserCheck,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Lead, LeadStatus } from '@/types/crm';

// Debounce hook for objects
const useDebounce = (value: {[key: string]: string}, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const licenseStyles = `
.license-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 320px;
}

.license-row {
  display: flex;
  gap: 8px;
}

.license-input {
  flex: 2;
  padding: 6px 8px;
  font-size: 13px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
}

.license-select {
  flex: 1.2;
  padding: 6px 8px;
  font-size: 13px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
}
`;

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-purple-100 text-purple-800',
  converted: 'bg-green-100 text-green-800',
  lost: 'bg-gray-100 text-gray-800',
};

export default function Leads() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusResponseOpen, setStatusResponseOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [statusResponse, setStatusResponse] = useState('');
  const [licenseUpdates, setLicenseUpdates] = useState<{[key: string]: string}>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<any>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const SHEET_API = "https://sheetdb.io/api/v1/xwraoa0tt1kgq";
  const STATUS_OPTIONS = ["New User", "complete", "incomplete"];
  const LICENSE_STATUS_OPTIONS = ["APPROVED", "UNDERPROCESS", "PAYMENT PENDING"];

  // Debounced license update function
  const debouncedLicenseUpdates = useDebounce(licenseUpdates, 1000);

  // Update license field in database
  const updateLicenseField = useCallback(async (leadId: string, field: string, value: string) => {
    try {
      await supabase
        .from("leads")
        .update({ [field]: value } as any)
        .eq("id", leadId);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    } catch (error) {
      console.error("Error updating license field:", error);
    }
  }, [queryClient]);

  // Convert lead to client mutation
  const convertToClientMutation = useMutation({
    mutationFn: async (lead: any) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      // Create client from lead data
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          user_id: user.id,
          lead_id: lead.id,
          name: lead.name || lead.phone,
          phone: lead.phone,
          address: lead.address,
          email: null, // Lead doesn't have email field
          billing_details: null,
          notes: `Converted from lead. Service interested: ${lead.service_interested}`,
        })
        .select()
        .single();
      
      if (clientError) throw clientError;
      
      // Update lead status to 'complete'
      const { error: leadError } = await supabase
        .from('leads')
        .update({ status: 'complete' } as any)
        .eq('id', lead.id);
      
      if (leadError) throw leadError;
      
      // Update Google Sheet
      await updateSheetLead(lead.phone, {
        Status: 'complete'
      });
      
      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        lead_id: lead.id,
        client_id: client.id,
        action: 'lead_converted',
        details: `Lead ${lead.name} converted to client`,
      });
      
      return client;
    },
    onSuccess: (client, lead) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(`Lead ${lead.name} converted to client successfully!`);
    },
    onError: (error) => {
      toast.error('Failed to convert lead to client: ' + error.message);
    },
  });

  // Delete lead mutation
  const deleteLeadMutation = useMutation({
    mutationFn: async (lead: any) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      // Delete from database
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', lead.id);
      
      if (error) throw error;
      
      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        lead_id: lead.id,
        action: 'lead_deleted',
        details: `Lead ${lead.name} deleted`,
      });
      
      return lead;
    },
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`Lead ${lead.name} deleted successfully!`);
      setDeleteDialogOpen(false);
      setLeadToDelete(null);
    },
    onError: (error) => {
      toast.error('Failed to delete lead: ' + error.message);
    },
  });

  // Effect to handle debounced updates
  useEffect(() => {
    Object.entries(debouncedLicenseUpdates).forEach(([key, value]) => {
      const [leadId, field] = key.split('|');
      updateLicenseField(leadId, field, value);
    });
  }, [debouncedLicenseUpdates, updateLicenseField]);

  // Handle license field change
  const handleLicenseChange = (leadId: string, field: string, value: string) => {
    setLicenseUpdates(prev => ({
      ...prev,
      [`${leadId}|${field}`]: value
    }));
  };

  // Real sync function
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(SHEET_API);
      const rows = await res.json();
      
      if (!rows || rows.length === 0) {
        toast.error("No leads found in WhatsApp");
        return;
      }

      // Format leads for database
      const formattedLeads = rows.map((row: any) => ({
        user_id: user?.id || '',
        name: row["Business_Name"] || "",
        phone: row["WhatsApp_ID"] || "",
        service_interested: row["Current_Service"] || "",
        address: row["Address"] || "",
        status: row["Status"] || "New User",
        status_response: row["Status_Response"] || "",
        lead_source: "google_sheet",
        notes: null,
        follow_up_date: null,
        google_sheet_row_id: null
      }));

      // Insert or update by phone
      for (const lead of formattedLeads) {
        const { error } = await supabase
          .from("leads")
          .upsert(lead as any, { onConflict: "phone" });
        
        if (error) throw error;
      }

      toast.success(`${formattedLeads.length} leads synced successfully!`);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      
    } catch (error: any) {
      console.error("Sync error:", error);
      toast.error("Failed to sync leads: " + (error.message || "Unknown error"));
    } finally {
      setSyncing(false);
    }
  };

  // Update Google Sheet
  const updateSheetLead = async (phone: string, updates: any) => {
    try {
      await fetch(`${SHEET_API}/WhatsApp_ID/${phone}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: updates })
      });
    } catch (err) {
      console.error("Sheet update failed:", err);
    }
  };

  // Open status response dialog
  const openStatusResponseDialog = (lead: any) => {
    setSelectedLead(lead);
    setStatusResponse(lead.status_response || '');
    setStatusResponseOpen(true);
  };

  // Save status response
  const saveStatusResponse = async () => {
    if (!selectedLead) return;

    try {
      // Update in Supabase
      const { error } = await supabase
        .from("leads")
        .update({ status_response: statusResponse } as any)
        .eq("id", selectedLead.id);

      if (error) throw error;

      // Update Google Sheet
      if (selectedLead.phone) {
        await updateSheetLead(selectedLead.phone, {
          Status_Response: statusResponse
        });
      }

      toast.success("Status response updated successfully!");
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setStatusResponseOpen(false);
      setSelectedLead(null);
    } catch (error: any) {
      console.error("Error saving status response:", error);
      toast.error("Failed to save status response: " + error.message);
    }
  };

  // Generate approved status message
  const generateApprovedStatusMessage = (lead: any) => {
    const licenses = [
      { name: lead.license_name_1, status: lead.license_status_1, link: lead.license_link_1 },
      { name: lead.license_name_2, status: lead.license_status_2, link: lead.license_link_2 },
      { name: lead.license_name_3, status: lead.license_status_3, link: lead.license_link_3 }
    ];

    const licenseLines = licenses
      .filter(l => l.name && l.status) // only include filled rows
      .map(l => `✅ Licence : ${l.name}  :  ${l.status}  (${l.link || "Download"})`)
      .join("\n");

    return `🎉 Good News!

${licenseLines}

🔘 TYPE " HI " TO START FROM START`;
  };

  // Generate rejected status message
  const generateRejectedStatusMessage = () => {
    return `❌ We regret to inform you that your [Licence Name] has been REJECTED.

Please reapply after 24-48 hours with proper documentation.

🔘 TYPE "HI" TO START FROM START`;
  };

  // Handle generate approved button
  const handleGenerateApproved = () => {
    const message = generateApprovedStatusMessage(selectedLead);
    setStatusResponse(message);
  };

  // Handle generate rejected button
  const handleGenerateRejected = () => {
    setStatusResponse(generateRejectedStatusMessage());
  };

  // Fetch leads from database
  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Add lead mutation
  const addLeadMutation = useMutation({
    mutationFn: async (lead: any) => {
      const { data, error } = await supabase
        .from('leads')
        .insert([{
          user_id: user?.id,
          ...lead,
          lead_source: 'manual',
          status_response: null
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead added successfully');
      setIsAddOpen(false);
    },
    onError: (error) => {
      toast.error('Failed to add lead: ' + error.message);
    },
  });

  const filteredLeads = leads?.filter((lead) =>
    lead?.name?.toLowerCase().includes(search.toLowerCase()) ||
    lead?.phone?.toLowerCase().includes(search.toLowerCase()) ||
    lead?.service_interested?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleAddLead = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addLeadMutation.mutate({
      name: formData.get('full_name') as string,
      phone: formData.get('phone') as string,
      service_interested: formData.get('service_interested') as string,
      address: formData.get('address') as string,
      notes: formData.get('notes') as string,
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Leads</h1>
            <p className="text-muted-foreground">Manage your leads and convert them to clients</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync from WhatsApp'}
            </Button>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Lead
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Lead</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddLead} className="space-y-4">
                  <div>
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input id="full_name" name="full_name" required />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" />
                  </div>
                  <div>
                    <Label htmlFor="service_interested">Service Interested</Label>
                    <Input id="service_interested" name="service_interested" />
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" name="address" />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" name="notes" />
                  </div>
                  <Button type="submit" className="w-full">Add Lead</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Licenses</TableHead>
                <TableHead>Status Response</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredLeads?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No leads found. Click "Sync from WhatsApp" to import leads.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads?.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{(lead as any).name}</TableCell>
                    <TableCell>{lead.phone || '-'}</TableCell>
                    <TableCell>{lead.service_interested || '-'}</TableCell>
                    <TableCell>{lead.address || '-'}</TableCell>
                    <TableCell>
                      <Select
                        value={lead.status}
                        onValueChange={async (value: "New User" | "complete" | "incomplete") => {
                          // Update in Supabase
                          await supabase
                            .from("leads")
                            .update({ status: value } as any)
                            .eq("id", lead.id);
                          
                          // Update Google Sheet
                          await updateSheetLead(lead.phone, {
                            Status: value
                          });
                          
                          queryClient.invalidateQueries({ queryKey: ['leads'] });
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <Badge className={
                            lead.status === "New User" ? 'bg-blue-100 text-blue-800' :
                            lead.status === "complete" ? 'bg-green-100 text-green-800' :
                            lead.status === "incomplete" ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {lead.status || 'New User'}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="New User">New User</SelectItem>
                          <SelectItem value="complete">Complete</SelectItem>
                          <SelectItem value="incomplete">Incomplete</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell style={{ minWidth: "350px" }}>
                      <div className="license-container">
                        {[1, 2, 3].map((num) => (
                          <div key={num} className="license-row">
                            <Input
                              placeholder="License Name"
                              className="license-input"
                              defaultValue={(lead as any)[`license_name_${num}`] || ''}
                              onChange={(e) => handleLicenseChange(lead.id, `license_name_${num}`, e.target.value)}
                            />
                            <Select
                              defaultValue={(lead as any)[`license_status_${num}`] || ''}
                              onValueChange={(value) => handleLicenseChange(lead.id, `license_status_${num}`, value)}
                            >
                              <SelectTrigger className="license-select">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                {LICENSE_STATUS_OPTIONS.map(status => (
                                  <SelectItem key={status} value={status}>{status}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Download Link"
                              className="license-input"
                              defaultValue={(lead as any)[`license_link_${num}`] || ''}
                              onChange={(e) => handleLicenseChange(lead.id, `license_link_${num}`, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="text-xs truncate">{(lead as any).status_response || '-'}</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openStatusResponseDialog(lead)}
                          className="h-6 px-2 text-xs"
                        >
                          Edit
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(lead.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openStatusResponseDialog(lead)}
                        >
                          <MessageSquare className="mr-1 h-4 w-4" />
                          Response
                        </Button>
                        {(lead as any).status !== 'complete' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => convertToClientMutation.mutate(lead)}
                            disabled={convertToClientMutation.isPending}
                          >
                            <UserCheck className="mr-1 h-4 w-4" />
                            {convertToClientMutation.isPending ? 'Converting...' : 'Convert to Client'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setLeadToDelete(lead);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={deleteLeadMutation.isPending}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Status Response Dialog */}
        <Dialog open={statusResponseOpen} onOpenChange={setStatusResponseOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Status Response
              </DialogTitle>
              <DialogDescription>
                Update the status response for {(selectedLead as any)?.name || 'Lead'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="statusResponse">Status Response Message</Label>
                <Textarea
                  id="statusResponse"
                  value={statusResponse}
                  onChange={(e) => setStatusResponse(e.target.value)}
                  placeholder="Enter status response message..."
                  rows={6}
                  className="mt-1"
                />
              </div>
              
              {/* Quick Generate Buttons */}
              <div className="space-y-2">
                <Label>Quick Generate</Label>
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateApproved}
                  >
                    Generate Approved Message
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateRejected}
                  >
                    Generate Rejected Message
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  onClick={saveStatusResponse}
                  className="flex-1"
                >
                  Save Response
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStatusResponseOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                Delete Lead
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete lead "{leadToDelete?.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="destructive"
                onClick={() => deleteLeadMutation.mutate(leadToDelete)}
                disabled={deleteLeadMutation.isPending}
                className="flex-1"
              >
                {deleteLeadMutation.isPending ? 'Deleting...' : 'Delete Lead'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setLeadToDelete(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}