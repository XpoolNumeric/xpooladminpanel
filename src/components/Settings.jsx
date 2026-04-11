import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Save, Loader2, DollarSign, Settings as SettingsIcon, Percent, MapPin,
    TrendingUp, Zap, AlertTriangle, Check, ChevronDown, ChevronUp,
    RotateCcw, Shield, IndianRupee, Layers, Car, Route, Info, Landmark
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageLayout from './shared/PageLayout';
import { formatCurrency } from '../lib/utils';

// ─── Default Tier Data (mirrors calculate-fare edge function) ────────────────
const DEFAULT_TIERS = [
    { name: 'Short Trip', min: 0, max: 10, base: 50, rateKm: 18, rateMin: 1.0, poolDiscount: 10, minPax: 2, maxPax: 4, description: 'City & nearby (0–10 km)' },
    { name: 'Suburban', min: 10, max: 50, base: 80, rateKm: 15, rateMin: 1.0, poolDiscount: 15, minPax: 2, maxPax: 4, description: 'Suburban areas (10–50 km)' },
    { name: 'Nearby Cities', min: 50, max: 100, base: 100, rateKm: 14, rateMin: 0.8, poolDiscount: 20, minPax: 3, maxPax: 4, description: 'Nearby cities (50–100 km)' },
    { name: 'Medium Distance', min: 100, max: 250, base: 150, rateKm: 13, rateMin: 0.8, poolDiscount: 25, minPax: 3, maxPax: 4, description: 'Medium trips (100–250 km)' },
    { name: 'Long Distance', min: 250, max: 500, base: 200, rateKm: 12, rateMin: 0.5, poolDiscount: 30, minPax: 4, maxPax: 4, description: 'Long trips (250–500 km)' },
    { name: 'Very Long', min: 500, max: 1000, base: 300, rateKm: 11, rateMin: 0.5, poolDiscount: 35, minPax: 4, maxPax: 4, description: 'Very long (500–1000 km)' },
    { name: 'Interstate', min: 1000, max: 5000, base: 500, rateKm: 10, rateMin: 0.5, poolDiscount: 40, minPax: 4, maxPax: 4, description: 'Interstate (1000+ km)' },
];

const DEFAULT_SETTINGS = {
    commission_rate: 15,
    base_fare: 50,
    price_per_km: 15,
    surge_pricing: false,
    surge_multiplier: 1.5,
    tiers: DEFAULT_TIERS,
};

// ─── Tier Color Map ─────────────────────────────────────────────────────────
const TIER_COLORS = [
    { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', accent: 'from-blue-500 to-cyan-500', dot: 'bg-blue-500' },
    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', accent: 'from-emerald-500 to-teal-500', dot: 'bg-emerald-500' },
    { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', accent: 'from-violet-500 to-purple-500', dot: 'bg-violet-500' },
    { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', accent: 'from-amber-500 to-orange-500', dot: 'bg-amber-500' },
    { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', accent: 'from-rose-500 to-pink-500', dot: 'bg-rose-500' },
    { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', accent: 'from-indigo-500 to-blue-500', dot: 'bg-indigo-500' },
    { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', accent: 'from-gray-600 to-gray-800', dot: 'bg-gray-500' },
];

// ─── Settings Component ─────────────────────────────────────────────────────
function Settings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [expandedTier, setExpandedTier] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [originalSettings, setOriginalSettings] = useState(DEFAULT_SETTINGS);

    // ─── Fetch Settings ─────────────────────────────────────────────────
    const fetchSettings = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('platform_config')
                .select('*')
                .eq('id', 1)
                .single();

            if (data && !error) {
                const loaded = {
                    commission_rate: data.commission_rate ?? 15,
                    base_fare: data.base_fare ?? 50,
                    price_per_km: data.price_per_km ?? 15,
                    surge_pricing: data.surge_pricing ?? false,
                    surge_multiplier: data.surge_multiplier ?? 1.5,
                    tiers: data.tiers ?? DEFAULT_TIERS,
                };
                setSettings(loaded);
                setOriginalSettings(loaded);
            }
        } catch (e) {
            console.warn('Config table may not exist, using defaults:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    // Track changes
    useEffect(() => {
        setHasChanges(JSON.stringify(settings) !== JSON.stringify(originalSettings));
    }, [settings, originalSettings]);

    // ─── Update Helpers ─────────────────────────────────────────────────
    const updateField = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const updateTier = (index, field, value) => {
        setSettings(prev => {
            const newTiers = [...prev.tiers];
            newTiers[index] = { ...newTiers[index], [field]: value };
            return { ...prev, tiers: newTiers };
        });
    };

    const resetToDefaults = () => {
        setSettings(DEFAULT_SETTINGS);
        toast.success('Reset to default values');
    };

    const discardChanges = () => {
        setSettings(originalSettings);
        setHasChanges(false);
        toast.success('Changes discarded');
    };

    // ─── Save Settings ──────────────────────────────────────────────────
    const handleSave = async () => {
        // Validate commission
        if (settings.commission_rate < 0 || settings.commission_rate > 50) {
            toast.error('Commission rate must be between 0% and 50%');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('platform_config')
                .upsert({
                    id: 1,
                    commission_rate: settings.commission_rate,
                    base_fare: settings.base_fare,
                    price_per_km: settings.price_per_km,
                    surge_pricing: settings.surge_pricing,
                    surge_multiplier: settings.surge_multiplier,
                    tiers: settings.tiers,
                    updated_at: new Date().toISOString(),
                });

            if (error) throw error;

            setOriginalSettings(settings);
            setHasChanges(false);
            toast.success('Settings saved successfully!');
        } catch (e) {
            console.error('Save error:', e);
            toast.error('Failed to save: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    // ─── Fare Preview Calculator ────────────────────────────────────────
    const calculatePreviewFare = (tier) => {
        const sampleDistances = { 'Short Trip': 8, 'Suburban': 30, 'Nearby Cities': 75, 'Medium Distance': 180, 'Long Distance': 350, 'Very Long': 700, 'Interstate': 1500 };
        const dist = sampleDistances[tier.name] || (tier.min + tier.max) / 2;
        const duration = dist * 1.2; // rough 1.2 min/km
        const raw = tier.base + (dist * tier.rateKm) + (duration * tier.rateMin);
        const afterDiscount = raw * (1 - tier.poolDiscount / 100);
        const perPerson = Math.round(afterDiscount / tier.minPax / 5) * 5;
        const commission = Math.round(perPerson * (settings.commission_rate / 100));
        const driverEarning = perPerson - commission;
        return { perPerson, commission, driverEarning, distance: dist };
    };

    // ─── Render ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <PageLayout color="amber">
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
            </PageLayout>
        );
    }

    return (
        <PageLayout color="amber">
            <div className="flex flex-col bg-transparent overflow-y-auto" style={{ maxHeight: 'calc(100vh - 80px)' }}>
                <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 pb-8">

                    {/* ── Header ────────────────────────────────────── */}
                    <div className="flex items-center justify-between gap-4 mb-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-lg shadow-amber-200/40">
                                <SettingsIcon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-gray-900 tracking-tight">Platform Settings</h1>
                                <p className="text-xs text-gray-500 font-medium">Commission, pricing tiers, and surge config</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {hasChanges && (
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    onClick={discardChanges}
                                    className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold transition-all flex items-center gap-1.5"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Discard
                                </motion.button>
                            )}
                            <motion.button
                                whileHover={hasChanges ? { scale: 1.02 } : {}}
                                whileTap={hasChanges ? { scale: 0.97 } : {}}
                                onClick={handleSave}
                                disabled={saving || !hasChanges}
                                className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-md ${
                                    hasChanges
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-200/40'
                                        : 'bg-gray-100 text-gray-400 shadow-none cursor-not-allowed'
                                }`}
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Saving…' : 'Save Changes'}
                            </motion.button>
                        </div>
                    </div>

                    {/* ── Unsaved Banner ─────────────────────────────── */}
                    <AnimatePresence>
                        {hasChanges && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="mb-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-amber-700"
                            >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                You have unsaved changes
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── Top Cards: Commission + Base Pricing ──────── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">

                        {/* Commission Rate Card */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                                    <Percent className="w-4.5 h-4.5 text-violet-600" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900">Commission Rate</h3>
                                    <p className="text-[10px] text-gray-400">Platform fee per ride</p>
                                </div>
                            </div>
                            <div className="flex items-end gap-2">
                                <input
                                    type="number"
                                    min="0" max="50" step="0.5"
                                    value={settings.commission_rate}
                                    onChange={(e) => updateField('commission_rate', Number(e.target.value))}
                                    className="w-24 text-3xl font-black text-violet-700 bg-transparent border-b-2 border-violet-200 focus:border-violet-500 outline-none text-center pb-1 transition-colors"
                                />
                                <span className="text-lg font-bold text-violet-400 pb-1">%</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2">
                                Driver receives {(100 - settings.commission_rate).toFixed(1)}% per trip
                            </p>
                        </div>

                        {/* Base Fare Card */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                                    <IndianRupee className="w-4.5 h-4.5 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900">Default Base Fare</h3>
                                    <p className="text-[10px] text-gray-400">Minimum fare per trip</p>
                                </div>
                            </div>
                            <div className="flex items-end gap-1">
                                <span className="text-lg font-bold text-amber-400 pb-1">₹</span>
                                <input
                                    type="number"
                                    min="0" step="5"
                                    value={settings.base_fare}
                                    onChange={(e) => updateField('base_fare', Number(e.target.value))}
                                    className="w-24 text-3xl font-black text-amber-700 bg-transparent border-b-2 border-amber-200 focus:border-amber-500 outline-none text-center pb-1 transition-colors"
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2">
                                Applied to short trips (0–10 km)
                            </p>
                        </div>

                        {/* Default Rate/Km Card */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                                    <Route className="w-4.5 h-4.5 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900">Default ₹/Km</h3>
                                    <p className="text-[10px] text-gray-400">Per-kilometer rate</p>
                                </div>
                            </div>
                            <div className="flex items-end gap-1">
                                <span className="text-lg font-bold text-emerald-400 pb-1">₹</span>
                                <input
                                    type="number"
                                    min="1" step="0.5"
                                    value={settings.price_per_km}
                                    onChange={(e) => updateField('price_per_km', Number(e.target.value))}
                                    className="w-24 text-3xl font-black text-emerald-700 bg-transparent border-b-2 border-emerald-200 focus:border-emerald-500 outline-none text-center pb-1 transition-colors"
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2">
                                Override per tier below
                            </p>
                        </div>
                    </div>

                    {/* ── Surge Pricing Section ────────────────────── */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                                    <Zap className="w-4.5 h-4.5 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900">Surge Pricing</h3>
                                    <p className="text-[10px] text-gray-400">Multiplier applied during peak demand</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {settings.surge_pricing && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-500">Multiplier:</span>
                                        <input
                                            type="number"
                                            min="1" max="5" step="0.1"
                                            value={settings.surge_multiplier}
                                            onChange={(e) => updateField('surge_multiplier', Number(e.target.value))}
                                            className="w-16 text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 text-center outline-none focus:ring-2 focus:ring-red-300"
                                        />
                                        <span className="text-xs font-bold text-red-400">×</span>
                                    </div>
                                )}
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={settings.surge_pricing}
                                        onChange={(e) => updateField('surge_pricing', e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500" />
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* ── Intercity Pricing Tiers ──────────────────── */}
                    <div className="mb-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-amber-500" />
                                <h2 className="text-sm font-bold text-gray-900">Intercity Pricing Tiers</h2>
                                <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-semibold">
                                    {settings.tiers.length} tiers
                                </span>
                            </div>
                            <button
                                onClick={resetToDefaults}
                                className="text-xs font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
                            >
                                <RotateCcw className="w-3 h-3" />
                                Reset Defaults
                            </button>
                        </div>

                        <div className="space-y-2.5">
                            {settings.tiers.map((tier, idx) => {
                                const clr = TIER_COLORS[idx % TIER_COLORS.length];
                                const isExpanded = expandedTier === idx;
                                const preview = calculatePreviewFare(tier);

                                return (
                                    <motion.div
                                        key={idx}
                                        layout
                                        className={`bg-white rounded-2xl border ${isExpanded ? clr.border : 'border-gray-100'} shadow-sm overflow-hidden transition-colors`}
                                    >
                                        {/* Tier Header (always visible) */}
                                        <button
                                            onClick={() => setExpandedTier(isExpanded ? null : idx)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-8 rounded-full ${clr.dot}`} />
                                                <div className="text-left">
                                                    <h4 className="text-sm font-bold text-gray-900">{tier.name}</h4>
                                                    <p className="text-[10px] text-gray-400">{tier.description}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="hidden sm:flex items-center gap-3 text-xs">
                                                    <span className={`px-2 py-1 rounded-lg font-bold ${clr.bg} ${clr.text}`}>
                                                        ₹{tier.rateKm}/km
                                                    </span>
                                                    <span className="text-gray-400 font-semibold">
                                                        Base: ₹{tier.base}
                                                    </span>
                                                    <span className="text-gray-400 font-semibold">
                                                        Pool: -{tier.poolDiscount}%
                                                    </span>
                                                </div>
                                                {isExpanded
                                                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                                                    : <ChevronDown className="w-4 h-4 text-gray-400" />
                                                }
                                            </div>
                                        </button>

                                        {/* Tier Details (expanded) */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.25 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className={`px-4 pb-4 pt-1 border-t ${clr.border}`}>
                                                        {/* Editable Fields Grid */}
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Base Fare (₹)</label>
                                                                <input
                                                                    type="number" min="0" step="5"
                                                                    value={tier.base}
                                                                    onChange={(e) => updateTier(idx, 'base', Number(e.target.value))}
                                                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 bg-gray-50"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Rate/Km (₹)</label>
                                                                <input
                                                                    type="number" min="1" step="0.5"
                                                                    value={tier.rateKm}
                                                                    onChange={(e) => updateTier(idx, 'rateKm', Number(e.target.value))}
                                                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 bg-gray-50"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Rate/Min (₹)</label>
                                                                <input
                                                                    type="number" min="0" step="0.1"
                                                                    value={tier.rateMin}
                                                                    onChange={(e) => updateTier(idx, 'rateMin', Number(e.target.value))}
                                                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 bg-gray-50"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Pool Discount (%)</label>
                                                                <input
                                                                    type="number" min="0" max="60" step="1"
                                                                    value={tier.poolDiscount}
                                                                    onChange={(e) => updateTier(idx, 'poolDiscount', Number(e.target.value))}
                                                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 bg-gray-50"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Min Passengers</label>
                                                                <input
                                                                    type="number" min="1" max="6"
                                                                    value={tier.minPax}
                                                                    onChange={(e) => updateTier(idx, 'minPax', Number(e.target.value))}
                                                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 bg-gray-50"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Max Passengers</label>
                                                                <input
                                                                    type="number" min="1" max="8"
                                                                    value={tier.maxPax}
                                                                    onChange={(e) => updateTier(idx, 'maxPax', Number(e.target.value))}
                                                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 bg-gray-50"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Live Fare Preview */}
                                                        <div className={`${clr.bg} rounded-xl p-3.5 border ${clr.border}`}>
                                                            <div className="flex items-center gap-1.5 mb-2">
                                                                <Info className="w-3 h-3 text-gray-400" />
                                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                                    Live Preview — Sample {preview.distance} km trip
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-4 text-center">
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Per Person</p>
                                                                    <p className={`text-lg font-black ${clr.text}`}>₹{preview.perPerson}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-violet-400 uppercase">Commission ({settings.commission_rate}%)</p>
                                                                    <p className="text-lg font-black text-violet-600">₹{preview.commission}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-emerald-400 uppercase">Driver Gets</p>
                                                                    <p className="text-lg font-black text-emerald-600">₹{preview.driverEarning}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Info Banner ──────────────────────────────── */}
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                        <Shield className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-xs font-bold text-blue-800 mb-1">How these settings are applied</p>
                            <p className="text-[11px] text-blue-600 leading-relaxed">
                                Changes to <strong>commission rate</strong> affect how much the platform retains from each ride payment.
                                The <strong>intercity tier rates</strong> control the fare calculator used when drivers publish trips.
                                After saving, your Edge Functions (<code className="bg-blue-100 px-1 rounded text-[10px]">calculate-fare</code>,
                                <code className="bg-blue-100 px-1 rounded text-[10px]">complete-passenger-drop</code>) will
                                read these values from the <code className="bg-blue-100 px-1 rounded text-[10px]">platform_config</code> table
                                on every invocation.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </PageLayout>
    );
}

export default Settings;
