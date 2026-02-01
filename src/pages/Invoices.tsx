import { useState, useEffect } from 'react';
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
import { Invoice, Client, Service, InvoiceStatus } from '@/types/crm';
import { Plus, Search, Download, CheckCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { generateInvoicePDF } from '@/utils/generateInvoicePDF';

const statusColors: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
};

export default function Invoices() {
  const [searchParams] = useSearchParams();
  const preselectedClientId = searchParams.get('client');
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(!!preselectedClientId);
  const [selectedClient, setSelectedClient] = useState<string>(preselectedClientId || '');
  const [items, setItems] = useState([{ description: '', quantity: 1, unit_price: 0 }]);
  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<(Invoice & { client: Client; invoice_items: any[] }) | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select('*, client:clients(*), invoice_items(*)')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as InvoiceStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (Invoice & { client: Client; invoice_items: any[] })[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Client[];
    },
  });

  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Service[];
    },
  });

  // Fetch leads with license names for auto-population
  const { data: leads } = useQuery({
    queryKey: ['leads-with-licenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .or('license_name_1.not.is.null,license_name_2.not.is.null,license_name_3.not.is.null')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Extract unique license names from leads
  const licenseNames = leads?.reduce((unique: string[], lead) => {
    [1, 2, 3].forEach(num => {
      const licenseName = lead[`license_name_${num}`];
      if (licenseName && !unique.includes(licenseName)) {
        unique.push(licenseName);
      }
    });
    return unique;
  }, []) || [];

  const addInvoiceMutation = useMutation({
    mutationFn: async (data: {
      client_id: string;
      due_date: string;
      tax_rate: number;
      discount: number;
      notes: string;
      items: { description: string; quantity: number; unit_price: number }[];
    }) => {
      const subtotal = data.items.reduce(
        (acc, item) => acc + item.quantity * item.unit_price,
        0
      );
      const tax_amount = subtotal * (data.tax_rate / 100);
      const total = subtotal + tax_amount - data.discount;

      // Generate invoice number
      const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: user?.id,
          client_id: data.client_id,
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: data.due_date,
          subtotal,
          tax_rate: data.tax_rate,
          tax_amount,
          discount: data.discount,
          total,
          status: 'draft',
          notes: data.notes,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Add invoice items
      const invoiceItems = data.items.map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);

      if (itemsError) throw itemsError;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        invoice_id: invoice.id,
        action: 'invoice_created',
        details: `Invoice ${invoiceNumber} created for ₹${total.toFixed(2)}`,
      });

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice created successfully');
      setIsAddOpen(false);
      setItems([{ description: '', quantity: 1, unit_price: 0 }]);
      setSelectedClient('');
      setTaxRate(0);
      setDiscount(0);
    },
    onError: (error) => {
      toast.error('Failed to create invoice: ' + error.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InvoiceStatus }) => {
      const { error } = await supabase
        .from('invoices')
        .update({ status })
        .eq('id', id);
      if (error) throw error;

      if (status === 'paid') {
        await supabase.from('activity_logs').insert({
          user_id: user?.id,
          invoice_id: id,
          action: 'invoice_paid',
          details: 'Invoice marked as paid',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Status updated');
    },
  });

  // Delete invoice mutation
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoice: Invoice & { client: Client; invoice_items: any[] }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      // Delete invoice items first
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoice.id);
      
      if (itemsError) throw itemsError;
      
      // Delete invoice
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);
      
      if (error) throw error;
      
      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        invoice_id: invoice.id,
        action: 'invoice_deleted',
        details: `Invoice ${invoice.invoice_number} for ${invoice.client?.name} deleted`,
      });
      
      return invoice;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success(`Invoice ${invoice.invoice_number} deleted successfully!`);
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    },
    onError: (error) => {
      toast.error('Failed to delete invoice: ' + error.message);
    },
  });

  const filteredInvoices = invoices?.filter((invoice) =>
    invoice.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    invoice.client?.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleDownloadInvoice = (invoice: Invoice & { client: Client; invoice_items: any[] }) => {
    try {
      // Calculate subtotal, tax, and total for the PDF
      const subtotal = invoice.invoice_items?.reduce((sum, item) => sum + Number(item.total), 0) || 0;
      const tax = subtotal * 0.18; // Assuming 18% tax
      const discount = 0; // Can be calculated from invoice if needed
      const total = Number(invoice.total);

      const pdfData = {
        ...invoice,
        subtotal,
        tax,
        discount,
        total
      };

      generateInvoicePDF(pdfData);
      toast.success('Invoice PDF downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  const handleAddInvoice = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addInvoiceMutation.mutate({
      client_id: selectedClient,
      due_date: formData.get('due_date') as string,
      tax_rate: parseFloat(formData.get('tax_rate') as string) || 0,
      discount: parseFloat(formData.get('discount') as string) || 0,
      notes: formData.get('notes') as string,
      items: items.filter((item) => item.description),
    });
  };

  const subtotal = items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discount;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Invoices</h1>
            <p className="text-muted-foreground">Create and manage branded AXIOM AI invoices</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Invoice</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddInvoice} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Client *</Label>
                    <Select value={selectedClient} onValueChange={setSelectedClient} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="due_date">Due Date *</Label>
                    <Input id="due_date" name="due_date" type="date" required />
                  </div>
                </div>

                {/* Invoice Items */}
                <div className="space-y-2">
                  <Label>Items</Label>
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2">
                      <div className="col-span-6">
                        <Select
                          value={item.description}
                          onValueChange={(value) => handleItemChange(index, 'description', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select license name" />
                          </SelectTrigger>
                          <SelectContent>
                            {licenseNames.map((licenseName) => (
                              <SelectItem key={licenseName} value={licenseName}>
                                {licenseName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="Qty"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="Rate"
                          min="0"
                          step="0.01"
                          value={item.unit_price || ''}
                          onChange={(e) =>
                            handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="col-span-2 flex items-center">
                        ₹{(item.quantity * item.unit_price).toFixed(2)}
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Item
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                    <Input 
                      id="tax_rate" 
                      name="tax_rate" 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      value={taxRate || ''}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="discount">Discount (₹)</Label>
                    <Input 
                      id="discount" 
                      name="discount" 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      value={discount || ''}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" />
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax ({taxRate}%):</span>
                    <span>₹{taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>-₹{discount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={!selectedClient}>
                  Create Invoice
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredInvoices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No invoices found. Create your first invoice.
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices?.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.client?.name || '-'}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {invoice.invoice_items?.map((item, index) => (
                          <div key={index} className="text-sm">
                            <div className="font-medium">{item.description}</div>
                            <div className="text-muted-foreground">
                              Qty: {item.quantity} × ₹{Number(item.unit_price).toFixed(2)} = ₹{Number(item.total).toFixed(2)}
                            </div>
                          </div>
                        )) || <span className="text-muted-foreground">No items</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(invoice.invoice_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="font-semibold">
                      ₹{Number(invoice.total).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[invoice.status]}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {invoice.status !== 'paid' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: invoice.id,
                                status: 'paid',
                              })
                            }
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDownloadInvoice(invoice)}
                          title="Download Invoice PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setInvoiceToDelete(invoice);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={deleteInvoiceMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                Delete Invoice
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete invoice "{invoiceToDelete?.invoice_number}" for {invoiceToDelete?.client?.name}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="destructive"
                onClick={() => deleteInvoiceMutation.mutate(invoiceToDelete)}
                disabled={deleteInvoiceMutation.isPending}
                className="flex-1"
              >
                {deleteInvoiceMutation.isPending ? 'Deleting...' : 'Delete Invoice'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setInvoiceToDelete(null);
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