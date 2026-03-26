import { useState } from 'react';
import { Trash2, ArrowRightLeft, Mail, DollarSign, RotateCcw, AlertTriangle, X, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useActiveSessions, useIncidentSessions } from '@/hooks/useSessions';

export const AdminPage = () => {

  const handlePinSubmit = () => {
    if (pinInput === '2520') {
      setUnlocked(true);
    } else {
      setPinInput('');
    }
  };

  if (!unlocked) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <Lock className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-xl font-extrabold uppercase tracking-[0.15em] text-foreground">
          Admin Pincode
        </h2>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
          placeholder="••••"
          className="w-40 bg-secondary text-foreground border border-border rounded-lg px-4 py-4 text-3xl font-bold text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/30"
        />
        <button
          onClick={handlePinSubmit}
          disabled={pinInput.length !== 4}
          className="pos-btn bg-primary text-primary-foreground rounded-lg px-8 py-3 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
        >
          UNLOCK
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-lg mx-auto space-y-4">
        <h2 className="text-xl font-extrabold uppercase tracking-[0.15em] text-primary mb-6">
          Admin Panel
        </h2>

        {/* Active sessions overview */}
        <ActiveSessionsSection />

        <AdminCard
          icon={<DollarSign className="w-5 h-5" />}
          title="FOOI UIT KAS"
          description="Verschil gepind bedrag vs productwaarde"
          value="€0.00"
        />

        <AdminButton
          icon={<Trash2 className="w-5 h-5" />}
          label="BATCH ERASE"
          description="Continu NFC-bandjes wissen"
          variant="destructive"
          onClick={() => {
            if (window.confirm('Weet je zeker door te gaan naar Batch Erase?')) {
              console.log('Batch erase started');
            }
          }}
        />

        <AdminButton
          icon={<ArrowRightLeft className="w-5 h-5" />}
          label="TRANSFER BANDJE"
          description="Data overzetten naar nieuw bandje"
          onClick={() => console.log('Transfer started')}
        />

        <AdminButton
          icon={<Mail className="w-5 h-5" />}
          label="CLOSE SHIFT (E-MAIL)"
          description="Voorraad + Debt List versturen, dagsaldo resetten"
          variant="primary"
          onClick={() => console.log('Close shift')}
        />

        <AdminButton
          icon={<RotateCcw className="w-5 h-5" />}
          label="CORRIGEER"
          description="Annuleren of fooi toevoegen"
          onClick={() => console.log('Correct')}
        />

        <AdminButton
          icon={<AlertTriangle className="w-5 h-5" />}
          label="INCIDENT"
          description="Probleem-sessie vlaggen"
          variant="destructive"
          onClick={() => console.log('Incident')}
        />

        <AdminButton
          icon={<X className="w-5 h-5" />}
          label="WISSEN"
          description="Huidige bestelling wissen"
          variant="destructive"
          onClick={() => console.log('Wissen')}
        />

        <button
          onClick={() => setUnlocked(false)}
          className="pos-btn text-xs text-muted-foreground hover:text-destructive mt-8"
        >
          VERGRENDEL ADMIN
        </button>
      </div>
    </div>
  );
};

const ActiveSessionsSection = () => {
  const { data: sessions, isLoading } = useActiveSessions();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 flex items-center gap-3 border-b border-border">
        <Users className="w-5 h-5 text-primary" />
        <div className="flex-1">
          <h3 className="text-sm font-extrabold uppercase">OPENSTAANDE BEZOEKERS</h3>
          <p className="text-xs text-muted-foreground">Actieve sessies</p>
        </div>
        <span className="text-lg font-extrabold text-primary">{sessions?.length ?? 0}</span>
      </div>

      {isLoading && (
        <div className="p-4 text-xs text-muted-foreground">Laden...</div>
      )}

      {sessions && sessions.length === 0 && (
        <div className="p-4 text-xs text-muted-foreground">Geen actieve sessies</div>
      )}

      {sessions && sessions.map((session) => {
        const isExpanded = expandedId === session.id;
        const label = session.wardrobe_number || (session.nfc_uid ? `UID: ${session.nfc_uid.slice(0, 8)}…` : 'Anoniem');
        const drinkLogs = (session as any).drink_logs ?? [];

        return (
          <div key={session.id} className="border-t border-border">
            <button
              onClick={() => setExpandedId(isExpanded ? null : session.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold">{label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-extrabold" style={{ color: '#00cc13' }}>
                  €{Number(session.total_amount).toFixed(2)}
                </span>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>
            {isExpanded && (
              <div className="px-4 pb-3">
                <div className="text-xs text-muted-foreground mb-2">
                  Start: {new Date(session.created_at).toLocaleTimeString('nl-NL')}
                </div>
                {drinkLogs.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Geen drankjes</div>
                ) : (
                  <div className="space-y-1">
                    {drinkLogs.map((log: any) => (
                      <div key={log.id} className="flex items-center justify-between text-xs">
                        <span className="font-bold uppercase">
                          {log.products?.full_name ?? log.product_id}
                        </span>
                        <span style={{ color: '#00cc13' }}>€{Number(log.price_at_time).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const AdminCard = ({ icon, title, description, value }: { icon: React.ReactNode; title: string; description: string; value: string }) => (
  <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
    <div className="text-primary">{icon}</div>
    <div className="flex-1">
      <h3 className="text-sm font-extrabold uppercase">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <span className="text-2xl font-extrabold text-primary">{value}</span>
  </div>
);

const AdminButton = ({ icon, label, description, variant, onClick }: {
  icon: React.ReactNode; label: string; description: string; variant?: string; onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`w-full text-left bg-card border border-border rounded-lg p-4 flex items-center gap-4 hover:brightness-110 transition-all active:scale-[0.98] ${
      variant === 'destructive' ? 'hover:border-destructive' : variant === 'primary' ? 'hover:border-primary' : 'hover:border-muted-foreground'
    }`}
  >
    <div className={variant === 'destructive' ? 'text-destructive' : variant === 'primary' ? 'text-primary' : 'text-muted-foreground'}>
      {icon}
    </div>
    <div>
      <h3 className="text-sm font-extrabold uppercase">{label}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  </button>
);
