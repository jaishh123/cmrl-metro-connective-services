import { useCallback, useEffect, useState } from 'react';
import { loadDomains, loadMetrics } from '../lib/data';
import { useAuth } from '../lib/auth';
import type { Domain, Metric } from '../lib/types';
import { Notice, PageHeader, Spinner } from '../components/ui';
import DomainManagement from '../components/input/DomainManagement';
import DailyEntry from '../components/input/DailyEntry';
import MonthlyEntry from '../components/input/MonthlyEntry';

export default function InputPage() {
  const { role } = useAuth();
  const [domains, setDomains] = useState<Domain[]>([]); const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try { const [d, m] = await Promise.all([loadDomains(), loadMetrics()]); setDomains(d); setMetrics(m); setError(''); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  return (
    <>
      <PageHeader title="Input" subtitle="Enter daily figures for each domain, and monthly figures for Pallavaram Parking and SC-GBS. Saved values appear immediately in Consolidation and Visualization." />
      {loading ? <Spinner /> : error ? (
        <Notice kind="error">Could not load domains: {error}. If this says the schema or table was not found, the "pms" schema migration has not been run, or "pms" is not listed under Exposed schemas in Supabase (see README step 4).</Notice>
      ) : (
        <div className="space-y-6">
          <DailyEntry domains={domains} metrics={metrics} onSaved={() => undefined}
            management={<DomainManagement domains={domains} isAdmin={role === 'admin'} onChanged={reload} />} />
          <MonthlyEntry domains={domains} metrics={metrics} onSaved={() => undefined} />
        </div>
      )}
    </>
  );
}
