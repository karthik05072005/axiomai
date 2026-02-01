import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { Users, UserCheck, Briefcase, FileText, IndianRupee } from 'lucide-react';

export default function Dashboard() {
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [leadsRes, clientsRes, servicesRes, invoicesRes] = await Promise.all([
        supabase.from('leads').select('id, status', { count: 'exact' }),
        supabase.from('clients').select('id', { count: 'exact' }),
        supabase.from('services').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('invoices').select('id, status, total'),
      ]);

      const pendingInvoices = invoicesRes.data?.filter(
        (i) => i.status === 'sent' || i.status === 'draft'
      ).length || 0;

      const paidInvoices = invoicesRes.data?.filter((i) => i.status === 'paid') || [];
      const revenue = paidInvoices.reduce((acc, inv) => acc + Number(inv.total), 0);

      return {
        totalLeads: leadsRes.count || 0,
        totalClients: clientsRes.count || 0,
        activeServices: servicesRes.count || 0,
        pendingInvoices,
        revenue,
      };
    },
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back to AXIOM AI CRM</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total Leads"
            value={stats?.totalLeads || 0}
            icon={Users}
          />
          <StatCard
            title="Total Clients"
            value={stats?.totalClients || 0}
            icon={UserCheck}
          />
          <StatCard
            title="Active Services"
            value={stats?.activeServices || 0}
            icon={Briefcase}
          />
          <StatCard
            title="Pending Invoices"
            value={stats?.pendingInvoices || 0}
            icon={FileText}
          />
          <StatCard
            title="Revenue"
            value={`₹${(stats?.revenue || 0).toLocaleString()}`}
            icon={IndianRupee}
          />
        </div>

        {/* Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentActivity />
        </div>
      </div>
    </MainLayout>
  );
}