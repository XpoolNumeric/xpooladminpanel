import React, { useState, useEffect, useCallback } from 'react';
import {
    Bell, Send, Users, AlertCircle, CheckCircle2, Info, Sparkles,
    Smartphone, Loader2, TrendingUp, Clock, Shield, Gift, Zap,
    Trash2, RefreshCw, Radio, CheckCheck, AlertTriangle, Check
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import PageLayout from './shared/PageLayout';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ───────────────────────────────────────────────────────────────────
type NotificationType = 'info' | 'success' | 'alert';
type TargetAudience = 'all' | 'drivers' | 'passengers';
type AITone = 'casual' | 'urgent' | 'professional' | 'inspirational';

interface QuickTemplate {
    id: string;
    name: string;
    title: string;
    message: string;
    type: NotificationType;
    audience: TargetAudience;
    icon: React.ReactNode;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const TITLE_MAX = 35;
const MESSAGE_MAX = 120;

const AUDIENCE_OPTIONS: { id: TargetAudience; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'Everyone', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'drivers', label: 'Drivers', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'passengers', label: 'Passengers', icon: <Clock className="w-3.5 h-3.5" /> },
];

const TONE_OPTIONS: { value: AITone; label: string }[] = [
    { value: 'casual', label: '😊 Casual' },
    { value: 'urgent', label: '⚡ Urgent' },
    { value: 'professional', label: '💼 Professional' },
    { value: 'inspirational', label: '✨ Inspirational' },
];

const TYPE_CONFIG = {
    info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50', activeBg: 'bg-blue-100', ring: 'ring-blue-200' },
    success: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', activeBg: 'bg-emerald-100', ring: 'ring-emerald-200' },
    alert: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50', activeBg: 'bg-red-100', ring: 'ring-red-200' },
} as const;

const QUICK_TEMPLATES: QuickTemplate[] = [
    { id: 'promo', name: 'Promo', title: '🎉 Special Offer Inside!', message: 'Enjoy 20% off your next 3 rides! Use code: XP2025', type: 'success', audience: 'all', icon: <Gift className="w-3.5 h-3.5" /> },
    { id: 'safety', name: 'Safety', title: '🛡️ Safety First', message: 'Share your trip details with loved ones for added security.', type: 'alert', audience: 'all', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'driver', name: 'Bonus', title: '💰 Driver Bonus Active', message: 'Complete 10 trips today & earn $50 bonus! Limited time.', type: 'success', audience: 'drivers', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'passenger', name: 'Reminder', title: '⏰ Ride Scheduled', message: 'Your ride to the airport is in 30 minutes. Your driver is on the way!', type: 'info', audience: 'passengers', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'urgent', name: 'Alert', title: '⚠️ Service Alert', message: 'Heavy rain expected. Expect longer wait times. Stay safe!', type: 'alert', audience: 'all', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
];

// ─── Component ───────────────────────────────────────────────────────────────
const PushNotifications = () => {
    // Form state
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState<NotificationType>('info');
    const [target, setTarget] = useState<TargetAudience>('all');
    const [aiTone, setAiTone] = useState<AITone>('professional');

    // UI state
    const [isSending, setIsSending] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [audienceCount, setAudienceCount] = useState<number | null>(null);
    const [isLoadingCount, setIsLoadingCount] = useState(false);
    const [keepAfterSend, setKeepAfterSend] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [lastSentCount, setLastSentCount] = useState<number | null>(null);

    // Derived state
    const isTitleValid = title.length <= TITLE_MAX;
    const isMessageValid = message.length <= MESSAGE_MAX;
    const isFormValid = title.trim() && message.trim() && isTitleValid && isMessageValid;
    const currentTypeConfig = TYPE_CONFIG[type];

    // ─── Data Fetching ─────────────────────────────────────────────────
    const fetchAudienceCount = useCallback(async () => {
        setIsLoadingCount(true);
        try {
            let query = supabase.from('profiles').select('id', { count: 'exact', head: true });
            if (target === 'drivers') query = query.eq('user_role', 'driver');
            else if (target === 'passengers') query = query.eq('user_role', 'passenger');

            const { count, error } = await query;
            if (error) throw error;
            setAudienceCount(count || 0);
        } catch (error) {
            console.error('Error fetching audience count:', error);
            setAudienceCount(null);
        } finally {
            setIsLoadingCount(false);
        }
    }, [target]);

    useEffect(() => { fetchAudienceCount(); }, [fetchAudienceCount]);

    // ─── AI Generation ─────────────────────────────────────────────────
    const generateContent = useCallback(async () => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) { toast.error("Gemini API key is not configured in .env"); return; }

        setIsGenerating(true);
        const loadingToast = toast.loading("AI is crafting your message… ✨");

        try {
            const audienceMap = { all: 'everyone', drivers: 'drivers', passengers: 'passengers' };
            const toneMap = {
                casual: 'casual, friendly, use emojis',
                urgent: 'urgent, action-oriented, create FOMO',
                professional: 'professional, clear, trustworthy',
                inspirational: 'inspiring, motivational, community-focused'
            };
            const contextSeed = (title || message)
                ? `Context from user: Title="${title}", Message="${message}". `
                : 'Create something fresh and engaging.';

            const prompt = `You are an expert copywriter for a ride-sharing/carpooling app named "Xpool". 
Write a short, engaging push notification targeted at ${audienceMap[target]}.
Tone: ${toneMap[aiTone]}.
${contextSeed}
Respond ONLY with a valid JSON object containing exactly two keys:
- "title": (max 35 characters, include an appropriate emoji, catchy)
- "message": (max 120 characters, persuasive and clear)
Never include markdown formatting blocks. Just the raw JSON.`;

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.8, topK: 40, topP: 0.95 }
                    })
                }
            );

            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || "Failed to generate AI response.");

            const textResponse = data.candidates[0].content.parts[0].text;
            const cleanedText = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
            const jsonContent = JSON.parse(cleanedText);

            setTitle(jsonContent.title || '');
            setMessage(jsonContent.message || '');
            toast.success("AI Content Generated! ✨", { id: loadingToast });
        } catch (error) {
            console.error("AI Generation Error:", error);
            toast.error("AI failed: " + (error as Error).message, { id: loadingToast });
        } finally {
            setIsGenerating(false);
        }
    }, [target, title, message, aiTone]);

    // ─── Template Application ──────────────────────────────────────────
    const applyTemplate = (template: QuickTemplate) => {
        setTitle(template.title);
        setMessage(template.message);
        setType(template.type);
        setTarget(template.audience);
        toast.success(`"${template.name}" applied`);
    };

    // ─── Send Notification ─────────────────────────────────────────────
    const handleSend = async () => {
        if (!title.trim() || !message.trim()) { toast.error('Please enter both title and message'); return; }
        if (title.length > TITLE_MAX) { toast.error(`Title must be ${TITLE_MAX} characters or less`); return; }
        if (message.length > MESSAGE_MAX) { toast.error(`Message must be ${MESSAGE_MAX} characters or less`); return; }

        setShowConfirmModal(false);
        setIsSending(true);
        const loadingToast = toast.loading(`Broadcasting to ${audienceCount || 'users'}…`);

        try {
            let query = supabase.from('profiles').select('id, user_role');
            if (target === 'drivers') query = query.eq('user_role', 'driver');
            else if (target === 'passengers') query = query.eq('user_role', 'passenger');

            const { data: users, error: fetchError } = await query;
            if (fetchError) throw fetchError;

            if (!users || users.length === 0) {
                toast.error('No users found for the selected target', { id: loadingToast });
                setIsSending(false);
                return;
            }

            const notifications = users.map(user => ({
                user_id: user.id,
                title: title.trim(),
                message: message.trim(),
                type,
                read: false,
                created_at: new Date().toISOString()
            }));

            const chunkSize = 500;
            let successCount = 0;
            for (let i = 0; i < notifications.length; i += chunkSize) {
                const chunk = notifications.slice(i, i + chunkSize);
                const { error: insertError } = await supabase.from('notifications').insert(chunk);
                if (insertError) throw insertError;
                successCount += chunk.length;
                toast.loading(`Sent ${successCount}/${users.length}…`, { id: loadingToast });
            }

            setLastSentCount(users.length);
            toast.success(
                <div className="flex items-center gap-2">
                    <CheckCheck className="w-5 h-5" />
                    <span>Successfully sent to {users.length} users!</span>
                </div>,
                { id: loadingToast, duration: 4000 }
            );

            if (!keepAfterSend) { setTitle(''); setMessage(''); }
        } catch (error) {
            console.error('Error sending push notification:', error);
            toast.error('Failed: ' + (error as Error).message, { id: loadingToast });
        } finally {
            setIsSending(false);
        }
    };

    // ─── Character Progress Bar ────────────────────────────────────────
    const ProgressBar = ({ current, max }: { current: number; max: number }) => {
        const pct = Math.min((current / max) * 100, 100);
        const isOver = current > max;
        return (
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden" style={{ minWidth: 48 }}>
                    <motion.div
                        className={`h-full rounded-full ${isOver ? 'bg-red-500' : pct > 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                </div>
                <span className={`text-[11px] font-bold tabular-nums ${isOver ? 'text-red-500' : 'text-gray-400'}`}>
                    {current}/{max}
                </span>
            </div>
        );
    };

    // ─── Render ────────────────────────────────────────────────────────
    return (
        <PageLayout color="amber">
            <div className="flex flex-col h-full bg-transparent overflow-hidden">
                <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 flex flex-col h-full">

                    {/* ── Header Row ───────────────────────────────────── */}
                    <div className="flex items-center justify-between gap-4 mb-3 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-lg shadow-amber-200/40">
                                <Bell className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-gray-900 tracking-tight">Broadcast Console</h1>
                                <p className="text-xs text-gray-500 font-medium">Craft & dispatch real-time push notifications</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setTitle(''); setMessage(''); setType('info'); setTarget('all'); toast.success("Form reset"); }}
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 text-gray-600 text-sm font-semibold transition-all flex items-center gap-1.5 border border-gray-200 shadow-sm"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Reset
                        </button>
                    </div>

                    {/* ── Quick Templates ───────────────────────────────── */}
                    <div className="flex items-center gap-2 mb-3 shrink-0 overflow-x-auto pb-1">
                        <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        {QUICK_TEMPLATES.map(t => (
                            <motion.button
                                key={t.id}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => applyTemplate(t)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-amber-50 rounded-lg text-xs font-semibold text-gray-600 hover:text-amber-700 transition-all border border-gray-200 hover:border-amber-300 whitespace-nowrap shadow-sm"
                            >
                                {t.icon}
                                {t.name}
                            </motion.button>
                        ))}
                    </div>

                    {/* ── Main Grid ─────────────────────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0">

                        {/* ── Left: Form ──────────────────────────────── */}
                        <div className="col-span-1 lg:col-span-7 flex flex-col min-h-0">
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg flex-1 flex flex-col overflow-hidden">
                                <form
                                    onSubmit={(e) => { e.preventDefault(); if (isFormValid) setShowConfirmModal(true); }}
                                    className="flex flex-col flex-1 p-4 md:p-5 gap-4"
                                >
                                    {/* Audience + AI row — side by side */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Audience */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Target Audience</label>
                                            <div className="flex gap-2">
                                                {AUDIENCE_OPTIONS.map(opt => (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        onClick={() => setTarget(opt.id)}
                                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                                                            target === opt.id
                                                                ? 'bg-amber-50 text-amber-700 ring-2 ring-amber-300 shadow-sm'
                                                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                                                        }`}
                                                    >
                                                        {target === opt.id && <Check className="w-3 h-3" />}
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex items-center justify-between mt-1.5 px-0.5">
                                                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                    <Users size={10} />
                                                    {isLoadingCount ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : `${audienceCount?.toLocaleString() ?? 0} recipients`}
                                                </span>
                                                {lastSentCount && (
                                                    <span className="text-[10px] text-emerald-500 flex items-center gap-0.5 font-semibold">
                                                        <CheckCheck size={10} /> Last: {lastSentCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* AI Controls */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">AI Assistant</label>
                                            <div className="flex gap-2">
                                                <select
                                                    value={aiTone}
                                                    onChange={(e) => setAiTone(e.target.value as AITone)}
                                                    className="text-xs border border-gray-200 rounded-xl px-2.5 py-2 bg-gray-50 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none flex-1 font-semibold text-gray-600"
                                                >
                                                    {TONE_OPTIONS.map(t => (
                                                        <option key={t.value} value={t.value}>{t.label}</option>
                                                    ))}
                                                </select>
                                                <motion.button
                                                    type="button"
                                                    whileHover={{ scale: 1.03 }}
                                                    whileTap={{ scale: 0.97 }}
                                                    onClick={generateContent}
                                                    disabled={isGenerating}
                                                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-md shadow-violet-200/50 text-xs"
                                                >
                                                    {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                                    Generate
                                                </motion.button>
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1.5 px-0.5">
                                                AI will auto-fill title & message based on tone
                                            </p>
                                        </div>
                                    </div>

                                    <hr className="border-gray-100" />

                                    {/* Title */}
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="text-xs font-bold text-gray-700">Notification Title</label>
                                            <ProgressBar current={title.length} max={TITLE_MAX} />
                                        </div>
                                        <input
                                            type="text"
                                            value={title}
                                            maxLength={45}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="e.g., Weekend Promo! 🎉"
                                            className={`w-full bg-gray-50 border text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 focus:bg-white px-3.5 py-2.5 transition-all font-medium placeholder-gray-400 outline-none ${
                                                !isTitleValid ? 'border-red-300 bg-red-50/50' : 'border-gray-200'
                                            }`}
                                        />
                                    </div>

                                    {/* Message */}
                                    <div className="flex-1 flex flex-col">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="text-xs font-bold text-gray-700">Message Body</label>
                                            <ProgressBar current={message.length} max={MESSAGE_MAX} />
                                        </div>
                                        <textarea
                                            value={message}
                                            maxLength={150}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="Type your compelling message here…"
                                            rows={2}
                                            className={`w-full bg-gray-50 border text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 focus:bg-white px-3.5 py-2.5 transition-all font-medium placeholder-gray-400 resize-none outline-none flex-1 ${
                                                !isMessageValid ? 'border-red-300 bg-red-50/50' : 'border-gray-200'
                                            }`}
                                        />
                                    </div>

                                    {/* Bottom bar: Type + Send */}
                                    <div className="flex items-center justify-between gap-3 pt-1">
                                        {/* Type selector */}
                                        <div className="flex gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
                                            {(['info', 'success', 'alert'] as const).map(s => {
                                                const cfg = TYPE_CONFIG[s];
                                                return (
                                                    <label
                                                        key={s}
                                                        className={`flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-lg transition-all duration-200 text-xs font-bold capitalize ${
                                                            type === s
                                                                ? `${cfg.activeBg} ${cfg.color} ring-1 ${cfg.ring}`
                                                                : 'text-gray-500 hover:bg-white'
                                                        }`}
                                                    >
                                                        <input type="radio" checked={type === s} onChange={() => setType(s)} className="sr-only" />
                                                        <cfg.icon size={13} />
                                                        {s}
                                                    </label>
                                                );
                                            })}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <label className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={keepAfterSend}
                                                    onChange={(e) => setKeepAfterSend(e.target.checked)}
                                                    className="rounded border-gray-300 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                                                />
                                                Keep after send
                                            </label>

                                            <motion.button
                                                type="submit"
                                                disabled={isSending || !isFormValid}
                                                whileHover={isFormValid ? { scale: 1.02 } : {}}
                                                whileTap={isFormValid ? { scale: 0.97 } : {}}
                                                className={`font-bold py-2.5 px-6 rounded-xl transition-all flex items-center gap-2 text-sm shadow-md ${
                                                    isFormValid
                                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-200/50'
                                                        : 'bg-gray-100 text-gray-400 shadow-none cursor-not-allowed'
                                                }`}
                                            >
                                                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={15} />}
                                                {isSending ? 'Sending…' : 'Broadcast'}
                                            </motion.button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* ── Right: Phone Preview ────────────────────── */}
                        <div className="col-span-1 lg:col-span-5 hidden lg:flex justify-center items-start">
                            <div className="w-[280px] bg-gradient-to-br from-gray-900 via-gray-850 to-gray-800 rounded-[32px] border-[3px] border-gray-700 shadow-2xl shadow-black/20 relative overflow-hidden flex flex-col items-center"
                                style={{ height: 'min(540px, calc(100vh - 200px))' }}>

                                {/* Dynamic Island */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90px] h-[28px] bg-black rounded-b-2xl z-20 flex justify-center items-end pb-1">
                                    <div className="w-8 h-[4px] bg-gray-700 rounded-full" />
                                </div>

                                {/* Screen gradient overlay */}
                                <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/15 via-transparent to-amber-900/10" />

                                {/* Status Bar */}
                                <div className="w-full px-5 pt-2 pb-0.5 flex justify-between items-center z-10 text-[10px] font-bold text-white/70">
                                    <span>9:41</span>
                                    <div className="flex gap-1 items-center">
                                        <div className="w-3 h-2 bg-white/50 rounded-[1px]" />
                                        <div className="w-3.5 h-2 bg-white/50 rounded-[1px]" />
                                    </div>
                                </div>

                                {/* App Header */}
                                <div className="w-full px-4 pt-1 pb-2 z-10 flex justify-between items-center">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/30">
                                            <Bell className="w-3 h-3 text-white" />
                                        </div>
                                        <span className="text-white font-bold text-xs">Xpool</span>
                                    </div>
                                    <div className="flex gap-1">
                                        {[0, 1, 2].map(i => <div key={i} className="w-1 h-1 bg-white/30 rounded-full" />)}
                                    </div>
                                </div>

                                {/* Notification Area */}
                                <div className="flex-1 w-full z-10 px-3 py-2 flex flex-col gap-3 overflow-hidden">
                                    <h3 className="text-[9px] font-black text-center text-white/30 uppercase tracking-[0.2em]">Lock Screen</h3>

                                    <AnimatePresence mode="wait">
                                        {(title || message) ? (
                                            <motion.div
                                                key="preview"
                                                initial={{ y: -15, opacity: 0, scale: 0.95 }}
                                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                                exit={{ y: 15, opacity: 0 }}
                                                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                                className={`${currentTypeConfig.bg} backdrop-blur-xl p-3 rounded-2xl shadow-xl border border-white/20`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className={`w-5 h-5 ${currentTypeConfig.bg} rounded-md flex items-center justify-center`}>
                                                            <currentTypeConfig.icon className={`w-3 h-3 ${currentTypeConfig.color}`} />
                                                        </div>
                                                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Xpool</span>
                                                        <span className="text-[8px] text-gray-400">• Now</span>
                                                    </div>
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase">
                                                        {target === 'all' ? 'All' : target === 'drivers' ? 'Drivers' : 'Passengers'}
                                                    </span>
                                                </div>
                                                {title && (
                                                    <h4 className="text-[13px] font-bold text-gray-900 leading-snug mb-1 break-words">{title}</h4>
                                                )}
                                                {message && (
                                                    <p className="text-[11px] text-gray-600 leading-[1.4] break-words font-medium">{message}</p>
                                                )}
                                                <div className="mt-2 pt-1.5 border-t border-gray-200/40 flex justify-end">
                                                    <span className="text-[8px] text-gray-400 font-medium">Swipe to open</span>
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="empty"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="bg-white/8 backdrop-blur-sm border border-white/15 p-5 rounded-2xl text-center"
                                            >
                                                <Smartphone className="w-8 h-8 text-white/30 mx-auto mb-2" />
                                                <p className="text-[11px] text-white/50 font-medium leading-relaxed">
                                                    Start typing to preview your notification
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Tips */}
                                    <div className="mt-auto p-2.5 bg-white/5 rounded-xl border border-white/10">
                                        <p className="text-[9px] text-white/40 font-medium text-center">
                                            💡 Keep titles under {TITLE_MAX} chars and messages under {MESSAGE_MAX} chars
                                        </p>
                                    </div>
                                </div>

                                {/* Home Indicator */}
                                <div className="w-24 h-1 bg-white/25 rounded-full mb-1.5 mt-0.5 z-10" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Confirmation Modal ──────────────────────────────────── */}
            <AnimatePresence>
                {showConfirmModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setShowConfirmModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-amber-100 rounded-xl">
                                    <Send className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Confirm Broadcast</h3>
                                    <p className="text-xs text-gray-500">This action cannot be undone</p>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-xl p-3.5 mb-4 border border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Preview</span>
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                        {audienceCount?.toLocaleString() || 0} recipients
                                    </span>
                                </div>
                                <p className="font-bold text-gray-900 text-sm">{title || '(No title)'}</p>
                                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{message || '(No message)'}</p>
                            </div>

                            <div className="flex gap-2.5">
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm"
                                >
                                    Cancel
                                </button>
                                <motion.button
                                    onClick={handleSend}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.97 }}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:from-amber-600 hover:to-orange-600 transition-all shadow-md shadow-amber-200/40 text-sm"
                                >
                                    🚀 Send Now
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </PageLayout>
    );
};

export default PushNotifications;