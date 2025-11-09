import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, CheckCircle, AlertTriangle, XCircle, Loader2, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

interface SanityCheckResult {
  ok: boolean;
  checked: number;
  mismatched: number;
  issues: Array<{
    productId: string;
    productName: string;
    onHand: number;
    sumOfMovements: number;
    difference: number;
  }>;
  message?: string;
}

interface SanityCheckModalProps {
  showModal: boolean;
  onClose: (result?: SanityCheckResult | null) => void;
}

const SanityCheckModal: React.FC<SanityCheckModalProps> = ({ showModal, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<SanityCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (showModal) {
      const runCheck = async () => {
        setIsLoading(true);
        setCheckResult(null);
        setError(null);
        try {
          const response = await fetch('/.netlify/functions/check-stock-sanity');
          const data: SanityCheckResult = await response.json();
          if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch sanity check results.');
          }
          setCheckResult(data);
        } catch (err: any) {
          console.error('Sanity check fetch error:', err);
          setError(err.message || 'Failed to connect to sanity check function.');
        } finally {
          setIsLoading(false);
        }
      };
      runCheck();
    }
  }, [showModal]);

  const handleClose = () => {
    onClose(checkResult); // Pass the result back to DataTab for toast
    setCheckResult(null); // Reset state for next open
    setError(null);
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in shadow-glow" onKeyDown={handleKeyDown}>
        <div className="flex items-center justify-between p-6 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-orange-500" /> Stock Sanity Check
          </h2>
          <Button onClick={handleClose} variant="ghost" size="sm">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 text-center">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-lg text-muted-foreground">Running sanity check...</p>
            </div>
          )}

          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center h-full text-destructive">
              <XCircle className="h-12 w-12 mb-4" />
              <p className="text-lg font-semibold">❌ Failed to run sanity check.</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
            </div>
          )}

          {!isLoading && checkResult && (
            <div className="space-y-4">
              {checkResult.ok ? (
                <div className="flex flex-col items-center justify-center text-success">
                  <CheckCircle className="h-12 w-12 mb-4" />
                  <p className="text-lg font-semibold">✅ All stock quantities are consistent.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {checkResult.checked} products verified.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-warning-foreground">
                  <AlertTriangle className="h-12 w-12 text-warning mb-4" />
                  <p className="text-lg font-semibold">⚠️ Issues detected in stock consistency.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {checkResult.mismatched} out of {checkResult.checked} products have mismatches.
                  </p>
                  {checkResult.issues && checkResult.issues.length > 0 && (
                    <div className="mt-6 w-full text-left border rounded-md p-4 bg-muted/50 max-h-60 overflow-y-auto">
                      <h3 className="font-medium text-base mb-3">Mismatched Products:</h3>
                      <ul className="space-y-2">
                        {checkResult.issues.map((issue, index) => (
                          <li key={index} className="border-b pb-2 last:border-b-0 last:pb-0">
                            <p className="font-semibold">{issue.productName} (ID: {issue.productId})</p>
                            <p className="text-sm text-muted-foreground">
                              On Hand: {issue.onHand}, Sum of Movements: {issue.sumOfMovements} (Difference: {issue.difference})
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 pt-4 border-t flex justify-end">
          <Button onClick={handleClose} variant="outline">
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default SanityCheckModal;