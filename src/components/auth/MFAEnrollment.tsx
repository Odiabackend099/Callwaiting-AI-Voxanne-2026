'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Download, Shield } from 'lucide-react';

export function MFAEnrollment() {
  const [step, setStep] = useState<'start' | 'scan' | 'verify' | 'complete'>('start');
  const [qrCode, setQRCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const startEnrollment = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/mfa/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start enrollment');
      }

      setQRCode(data.qrCode);
      setSecret(data.secret);
      setStep('scan');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyEnrollment = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/mfa/verify-enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, code: verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      setRecoveryCodes(data.recoveryCodes);
      setStep('complete');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadRecoveryCodes = () => {
    const content = recoveryCodes.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'voxanne-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Two-Factor Authentication</CardTitle>
        </div>
        <CardDescription>
          Add an extra layer of security to your account
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 'start' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Two-factor authentication (2FA) adds an extra layer of security to your account.
              You'll need to enter a code from your authenticator app each time you sign in.
            </p>
            <Button onClick={startEnrollment} disabled={loading} className="w-full">
              {loading ? 'Setting up...' : 'Get Started'}
            </Button>
          </div>
        )}

        {step === 'scan' && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm font-medium mb-4">
                Scan this QR code with your authenticator app
              </p>
              {qrCode && (
                <div className="flex justify-center mb-4">
                  <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                </div>
              )}
              <p className="text-xs text-muted-foreground mb-2">
                Or enter this code manually:
              </p>
              <code className="text-xs bg-muted px-2 py-1 rounded">{secret}</code>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Verification Code</label>
              <Input
                type="text"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
            </div>

            <Button
              onClick={verifyEnrollment}
              disabled={loading || verificationCode.length !== 6}
              className="w-full"
            >
              {loading ? 'Verifying...' : 'Verify and Enable'}
            </Button>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center text-green-600 mb-4">
              <CheckCircle2 className="h-12 w-12" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">2FA Enabled Successfully!</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your account is now protected with two-factor authentication.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Recovery Codes</h4>
              <p className="text-xs text-muted-foreground">
                Save these codes in a safe place. Each can be used once if you lose access to
                your authenticator app.
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  {recoveryCodes.map((code, i) => (
                    <div key={i} className="text-center">
                      {code}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button onClick={downloadRecoveryCodes} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download Recovery Codes
            </Button>

            <Button onClick={() => window.location.reload()} className="w-full">
              Done
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
