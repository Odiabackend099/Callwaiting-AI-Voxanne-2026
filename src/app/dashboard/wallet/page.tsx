'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Wallet, ArrowUpRight, ArrowDownLeft, CreditCard, RefreshCw,
    TrendingUp, AlertTriangle, ChevronLeft, ChevronRight,
    Loader2, Plus, X, Phone
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import useSWR from 'swr';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

const fetcher = (url: string) => authedBackendFetch<any>(url);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WalletData {
    balance_pence: number;
    balance_formatted: string;
    low_balance_pence: number;
    is_low_balance: boolean;
    auto_recharge_enabled: boolean;
    has_payment_method: boolean;
    summary: {
        total_spent_pence: number;
        total_calls: number;
        total_topped_up_pence: number;
        total_profit_pence: number;
        recharge_amount_pence: number;
        markup_percent: number;
    } | null;
}

interface Transaction {
    id: string;
    type: 'topup' | 'call_deduction' | 'refund' | 'adjustment' | 'bonus';
    amount_pence: number;
    direction: 'credit' | 'debit';
    balance_after_pence: number;
    description: string | null;
    created_at: string;
}

interface TransactionsResponse {
    transactions: Transaction[];
    pagination: { page: number; limit: number; total: number; total_pages: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPence(pence: number): string {
    // Display as USD for customer (internal is still GBP pence)
    const USD_TO_GBP_RATE = 0.79;
    const usdAmount = (pence / USD_TO_GBP_RATE / 100).toFixed(2);
    return `$${usdAmount}`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

const TX_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
    topup:          { icon: ArrowUpRight,  label: 'Top-Up',       color: 'text-green-600' },
    call_deduction: { icon: ArrowDownLeft, label: 'Call Charge',  color: 'text-red-500' },
    refund:         { icon: RefreshCw,     label: 'Refund',       color: 'text-surgical-600' },
    adjustment:     { icon: CreditCard,    label: 'Adjustment',   color: 'text-obsidian/60' },
    bonus:          { icon: Plus,          label: 'Bonus',        color: 'text-surgical-600' },
};

// ---------------------------------------------------------------------------
// Main Content
// ---------------------------------------------------------------------------

const WalletPageContent = () => {
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const { success: showSuccess, error: showError, info: showInfo } = useToast();

    // Data fetching
    const [txPage, setTxPage] = useState(1);
    const [txType, setTxType] = useState('');

    const txParams = new URLSearchParams({ page: String(txPage), limit: '20' });
    if (txType) txParams.set('type', txType);

    const { data: wallet, isLoading: walletLoading, mutate: mutateWallet } =
        useSWR<WalletData>(user ? '/api/billing/wallet' : null, fetcher, { revalidateOnFocus: false });

    const { data: txData, isLoading: txLoading, mutate: mutateTx } =
        useSWR<TransactionsResponse>(user ? `/api/billing/wallet/transactions?${txParams}` : null, fetcher, { revalidateOnFocus: false });

    // Top-up modal state
    const [showTopUp, setShowTopUp] = useState(false);
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [customAmount, setCustomAmount] = useState('');
    const [processingTopUp, setProcessingTopUp] = useState(false);

    // Auto-recharge state
    const [arEnabled, setArEnabled] = useState(false);
    const [arThreshold, setArThreshold] = useState('5.00');
    const [arAmount, setArAmount] = useState('50.00');
    const [savingAr, setSavingAr] = useState(false);

    // Init auto-recharge from server data
    useEffect(() => {
        if (wallet) {
            setArEnabled(wallet.auto_recharge_enabled);
            setArThreshold(((wallet.low_balance_pence ?? 500) / 100).toFixed(2));
            setArAmount(((wallet.summary?.recharge_amount_pence ?? 5000) / 100).toFixed(2));
        }
    }, [wallet]);

    // Handle Stripe redirect
    useEffect(() => {
        const param = searchParams.get('topup');
        if (param === 'success') {
            showSuccess('Credits added successfully! Your balance has been updated.');
            mutateWallet();
            mutateTx();
            window.history.replaceState({}, '', '/dashboard/wallet');
        } else if (param === 'canceled') {
            showInfo('Top-up was cancelled. No charges were made.');
            window.history.replaceState({}, '', '/dashboard/wallet');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // Handlers
    const handleTopUp = useCallback(async () => {
        const pence = selectedAmount || Math.round(parseFloat(customAmount) * 100);
        if (!pence || pence < 1975) { // $25 USD = ~1975 pence at 0.79 rate
            showError('Minimum top-up is $25.00');
            return;
        }
        setProcessingTopUp(true);
        try {
            const data = await authedBackendFetch<{ url: string }>('/api/billing/wallet/topup', {
                method: 'POST',
                body: JSON.stringify({ amount_pence: pence }),
            });
            window.location.href = data.url;
        } catch (err: any) {
            showError(err?.message || 'Failed to create checkout session');
            setProcessingTopUp(false);
        }
    }, [selectedAmount, customAmount, showError]);

    const handleSaveAutoRecharge = useCallback(async () => {
        setSavingAr(true);
        try {
            await authedBackendFetch('/api/billing/wallet/auto-recharge', {
                method: 'POST',
                body: JSON.stringify({
                    enabled: arEnabled,
                    threshold_pence: Math.round(parseFloat(arThreshold) * 100),
                    amount_pence: Math.round(parseFloat(arAmount) * 100),
                }),
            });
            showSuccess('Auto-recharge settings saved');
            mutateWallet();
        } catch (err: any) {
            showError(err?.message || 'Failed to save settings');
        } finally {
            setSavingAr(false);
        }
    }, [arEnabled, arThreshold, arAmount, showSuccess, showError, mutateWallet]);

    const summary = wallet?.summary;
    const txList = txData?.transactions ?? [];
    const pagination = txData?.pagination;

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    return (
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <Wallet className="w-7 h-7 text-surgical-600" />
                    <h1 className="text-3xl font-bold text-obsidian tracking-tight">Wallet</h1>
                </div>
                <p className="text-obsidian/60 text-sm">Manage your prepaid credits and billing</p>
            </div>

            {/* Balance Card */}
            <div className="bg-white border border-surgical-200 rounded-2xl p-6 md:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <p className="text-xs font-semibold text-obsidian/40 uppercase tracking-wider">
                                Current Balance
                            </p>
                            <span className="px-2.5 py-1 bg-surgical-50 text-surgical-600 rounded-full text-xs font-bold">
                                $0.70/min
                            </span>
                        </div>
                        {walletLoading ? (
                            <span className="animate-pulse bg-surgical-100 rounded h-12 w-40 inline-block" />
                        ) : (
                            <>
                                <p className="text-5xl font-bold text-obsidian tracking-tight">
                                    {wallet ? formatPence(wallet.balance_pence) : '$0.00'}
                                </p>
                                {wallet && wallet.balance_pence > 0 && (
                                    <p className="text-sm text-obsidian/60 mt-2">
                                        ~{Math.floor(wallet.balance_pence / Math.ceil(70 * 0.79))} minutes remaining at $0.70/min
                                    </p>
                                )}
                            </>
                        )}
                        {wallet?.is_low_balance && (
                            <div className="flex items-center gap-2 mt-3 text-amber-600">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="text-sm font-medium">
                                    Low balance — top up to avoid service interruption
                                </span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setShowTopUp(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-surgical-600 text-white rounded-xl hover:bg-surgical-700 transition-colors font-medium text-sm shadow-sm shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                        Top Up
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { icon: TrendingUp,    label: 'Total Top-Ups',   value: summary ? formatPence(summary.total_topped_up_pence) : '-' },
                    { icon: ArrowDownLeft, label: 'Total Spent',     value: summary ? formatPence(summary.total_spent_pence) : '-' },
                    { icon: Phone,         label: 'Total Calls',     value: summary ? String(summary.total_calls) : '-' },
                    { icon: CreditCard,    label: 'Auto-Recharge',   value: wallet ? (wallet.auto_recharge_enabled ? 'On' : 'Off') : '-',
                      valueColor: wallet?.auto_recharge_enabled ? 'text-surgical-600' : 'text-obsidian/40' },
                ].map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.label} className="bg-white border border-surgical-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-surgical-50">
                                    <Icon className="w-4 h-4 text-surgical-600" />
                                </div>
                            </div>
                            {walletLoading ? (
                                <span className="animate-pulse bg-surgical-100 rounded h-7 w-16 inline-block" />
                            ) : (
                                <p className={`text-2xl font-bold ${(card as any).valueColor || 'text-obsidian'}`}>
                                    {card.value}
                                </p>
                            )}
                            <p className="text-xs text-obsidian/60 font-medium mt-0.5">{card.label}</p>
                        </div>
                    );
                })}
            </div>

            {/* Two-Column: Transactions + Auto-Recharge */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Transactions */}
                <div className="lg:col-span-2 bg-white border border-surgical-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-surgical-200 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-obsidian tracking-tight">Transaction History</h3>
                        <select
                            value={txType}
                            onChange={(e) => { setTxType(e.target.value); setTxPage(1); }}
                            className="px-3 py-1.5 border border-surgical-200 rounded-lg text-sm text-obsidian bg-white focus:outline-none focus:ring-2 focus:ring-surgical-200"
                        >
                            <option value="">All Types</option>
                            <option value="topup">Top-Ups</option>
                            <option value="call_deduction">Call Charges</option>
                            <option value="refund">Refunds</option>
                            <option value="adjustment">Adjustments</option>
                            <option value="bonus">Bonuses</option>
                        </select>
                    </div>

                    {txLoading ? (
                        <div className="p-8 space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="animate-pulse flex items-center gap-4">
                                    <span className="bg-surgical-100 rounded-full w-8 h-8" />
                                    <span className="bg-surgical-100 rounded h-4 flex-1" />
                                    <span className="bg-surgical-100 rounded h-4 w-16" />
                                </div>
                            ))}
                        </div>
                    ) : txList.length === 0 ? (
                        <div className="text-center py-16">
                            <Wallet className="w-12 h-12 text-obsidian/20 mx-auto mb-3" />
                            <p className="text-obsidian font-medium">No transactions yet</p>
                            <p className="text-sm text-obsidian/60 mt-1">Top up your wallet to get started</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs font-semibold text-obsidian/40 uppercase tracking-wider border-b border-surgical-100">
                                            <th className="px-5 py-3">Date</th>
                                            <th className="px-5 py-3">Type</th>
                                            <th className="px-5 py-3 hidden sm:table-cell">Description</th>
                                            <th className="px-5 py-3 text-right">Amount</th>
                                            <th className="px-5 py-3 text-right hidden sm:table-cell">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surgical-100">
                                        {txList.map((tx) => {
                                            const meta = TX_META[tx.type] || TX_META.adjustment;
                                            const TxIcon = meta.icon;
                                            const isCredit = tx.direction === 'credit';
                                            return (
                                                <tr key={tx.id} className="hover:bg-surgical-50/50 transition-colors">
                                                    <td className="px-5 py-3 whitespace-nowrap text-obsidian/60">
                                                        {formatDate(tx.created_at)}
                                                    </td>
                                                    <td className="px-5 py-3 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <TxIcon className={`w-4 h-4 ${meta.color}`} />
                                                            <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3 text-obsidian/60 truncate max-w-[200px] hidden sm:table-cell">
                                                        {tx.description || '--'}
                                                    </td>
                                                    <td className={`px-5 py-3 text-right font-semibold whitespace-nowrap ${isCredit ? 'text-green-600' : 'text-obsidian'}`}>
                                                        {isCredit ? '+' : '-'}{formatPence(tx.amount_pence)}
                                                    </td>
                                                    <td className="px-5 py-3 text-right text-obsidian/40 whitespace-nowrap hidden sm:table-cell">
                                                        {formatPence(tx.balance_after_pence)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {pagination && pagination.total_pages > 1 && (
                                <div className="px-5 py-3 border-t border-surgical-100 flex items-center justify-between text-sm">
                                    <span className="text-obsidian/40">
                                        {pagination.total} transaction{pagination.total !== 1 ? 's' : ''}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                                            disabled={txPage <= 1}
                                            className="p-1.5 rounded-lg border border-surgical-200 disabled:opacity-30 hover:bg-surgical-50 transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <span className="text-obsidian/60 min-w-[80px] text-center">
                                            Page {pagination.page} of {pagination.total_pages}
                                        </span>
                                        <button
                                            onClick={() => setTxPage((p) => Math.min(pagination.total_pages, p + 1))}
                                            disabled={txPage >= pagination.total_pages}
                                            className="p-1.5 rounded-lg border border-surgical-200 disabled:opacity-30 hover:bg-surgical-50 transition-colors"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Auto-Recharge Card */}
                <div className="lg:col-span-1 bg-white border border-surgical-200 rounded-2xl overflow-hidden shadow-sm h-fit">
                    <div className="p-5 border-b border-surgical-200">
                        <h3 className="text-lg font-bold text-obsidian tracking-tight">Auto-Recharge</h3>
                        <p className="text-xs text-obsidian/60 mt-1">Automatically top up when balance is low</p>
                    </div>
                    <div className="p-5 space-y-5">
                        {/* Toggle */}
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-obsidian">Enable auto-recharge</label>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={arEnabled}
                                onClick={() => setArEnabled(!arEnabled)}
                                className={`relative w-11 h-6 rounded-full transition-colors ${arEnabled ? 'bg-surgical-600' : 'bg-obsidian/20'}`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${arEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {arEnabled && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-obsidian mb-1.5">
                                        Recharge when balance falls below
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-obsidian/40 font-medium">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="1"
                                            value={arThreshold}
                                            onChange={(e) => setArThreshold(e.target.value)}
                                            className="w-full pl-8 pr-4 py-2.5 border border-surgical-200 rounded-lg text-sm text-obsidian focus:outline-none focus:ring-2 focus:ring-surgical-200"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-obsidian mb-1.5">
                                        Recharge amount
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-obsidian/40 font-medium">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="10"
                                            value={arAmount}
                                            onChange={(e) => setArAmount(e.target.value)}
                                            className="w-full pl-8 pr-4 py-2.5 border border-surgical-200 rounded-lg text-sm text-obsidian focus:outline-none focus:ring-2 focus:ring-surgical-200"
                                        />
                                    </div>
                                </div>

                                {!wallet?.has_payment_method && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                                        No payment method saved. Complete a top-up first to save a card.
                                    </div>
                                )}
                            </>
                        )}

                        <button
                            onClick={handleSaveAutoRecharge}
                            disabled={savingAr}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 transition-colors font-medium text-sm disabled:opacity-60"
                        >
                            {savingAr ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {savingAr ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Top-Up Modal */}
            {showTopUp && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-xl">
                        <div className="px-6 py-4 border-b border-surgical-200 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-obsidian">Top Up Credits</h2>
                            <button
                                onClick={() => { setShowTopUp(false); setSelectedAmount(null); setCustomAmount(''); }}
                                className="p-1.5 rounded-lg text-obsidian/40 hover:bg-surgical-50 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <p className="text-sm text-obsidian/60">Select an amount or enter a custom value</p>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { pence: 1975, label: '$25', minutes: '~35 min' },
                                    { pence: 3950, label: '$50', minutes: '~71 min' },
                                    { pence: 7900, label: '$100', minutes: '~142 min' },
                                    { pence: 15800, label: '$200', minutes: '~286 min' }
                                ].map((option) => (
                                    <button
                                        key={option.pence}
                                        onClick={() => { setSelectedAmount(option.pence); setCustomAmount(''); }}
                                        className={`p-4 rounded-xl border-2 text-center transition-all
                                            ${selectedAmount === option.pence
                                                ? 'border-surgical-600 bg-surgical-50 text-surgical-600'
                                                : 'border-surgical-200 hover:border-surgical-300 text-obsidian'
                                            }`}
                                    >
                                        <div className="font-bold text-lg">{option.label}</div>
                                        <div className="text-xs text-obsidian/60 mt-1">{option.minutes}</div>
                                    </button>
                                ))}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-obsidian mb-1.5">
                                    Custom amount (min $25)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-obsidian/40 font-medium">$</span>
                                    <input
                                        type="number"
                                        min="25"
                                        step="1"
                                        value={customAmount}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setCustomAmount(val);
                                            setSelectedAmount(null);
                                        }}
                                        placeholder="25.00"
                                        className="w-full pl-8 pr-4 py-2.5 border border-surgical-200 rounded-lg text-sm text-obsidian focus:outline-none focus:ring-2 focus:ring-surgical-200"
                                    />
                                </div>
                                {customAmount && parseFloat(customAmount) >= 25 && (
                                    <p className="text-xs text-obsidian/60 mt-1.5">
                                        ~{Math.floor((parseFloat(customAmount) * 0.79 * 100) / Math.ceil(70 * 0.79))} minutes at $0.70/min
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-surgical-200">
                            <p className="text-xs text-obsidian/60 mb-3 text-center">
                                💡 You'll be charged in GBP (British Pounds). USD amounts are approximate based on current exchange rate.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => { setShowTopUp(false); setSelectedAmount(null); setCustomAmount(''); }}
                                    className="px-4 py-2 border border-surgical-200 rounded-lg text-sm font-medium text-obsidian hover:bg-surgical-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleTopUp}
                                    disabled={processingTopUp || (!selectedAmount && !customAmount)}
                                    className="flex items-center gap-2 px-5 py-2 bg-surgical-600 text-white rounded-lg text-sm font-medium hover:bg-surgical-700 transition-colors disabled:opacity-60"
                                >
                                    {processingTopUp ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                                    ) : (
                                        'Proceed to Payment'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default function WalletPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen bg-surgical-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-surgical-200 border-t-surgical-600 rounded-full animate-spin" />
                    <p className="text-obsidian/60">Loading...</p>
                </div>
            </div>
        }>
            <WalletPageContent />
        </React.Suspense>
    );
}
