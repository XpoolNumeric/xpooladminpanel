import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Download, Loader2, BarChart2, Calendar, TrendingUp, TrendingDown, Wallet, Banknote, Users, Car, PiggyBank, ArrowUpRight, ArrowDownRight, IndianRupee, Receipt, CircleDollarSign, Landmark } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import PageLayout from './shared/PageLayout';
import { formatCurrency } from '../lib/utils';

// ─── Skeleton ────────────────────────────────────────────────────────────────
const KPISkeleton = () => (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 animate-pulse">
        <div className="w-10 h-10 rounded-xl bg-gray-100 mb-3" />
        <div className="h-2.5 w-16 bg-gray-100 rounded mb-2" />
        <div className="h-7 w-24 bg-gray-100 rounded" />
    </div>
);

const ChartSkeleton = () => (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse">
        <div className="h-4 w-44 bg-gray-100 rounded mb-6" />
        <div className="h-[260px] bg-gray-50 rounded-xl" />
    </div>
);

// ─── Component ───────────────────────────────────────────────────────────────
function Reports() {
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState([]);
    const [commissionChartData, setCommissionChartData] = useState([]);
    const [financials, setFinancials] = useState({
        platformCommission: 0,
        driverEarnings: 0,
        grossTPV: 0,
        totalTrips: 0,
        completedTrips: 0,
        avgFarePerTrip: 0,
        totalPassengers: 0,
        commissionRate: 15,
    });

    const fetchReportData = useCallback(async () => {
        setLoading(true);

        // Initialize last 7 days with 0 values
        const revenueGrouped = {};
        const commissionGrouped = {};
        for (let i = 6; i >= 0; i--) {
            const dateStr = format(subDays(new Date(), i), 'MMM dd');
            revenueGrouped[dateStr] = 0;
            commissionGrouped[dateStr] = { commission: 0, driverPay: 0 };
        }

        try {
            const sevenDaysAgo = subDays(new Date(), 7);

            // Fetch all data in parallel (including live config)
            const [
                { data: tripsData, error: tripsError },
                { data: paymentsData, error: paymentsError },
                { count: totalTripsCount },
                { count: completedTripsCount },
                { count: totalPassengers },
                { data: configData },
            ] = await Promise.all([
                supabase
                    .from('trips')
                    .select('created_at, price_per_seat')
                    .gte('created_at', sevenDaysAgo.toISOString())
                    .eq('status', 'completed'),
                supabase
                    .from('ride_payments')
                    .select('commission_amount, driver_amount, total_amount, created_at, payment_status'),
                supabase.from('trips').select('*', { count: 'exact', head: true }),
                supabase.from('trips').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
                supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_role', 'passenger'),
                supabase.from('platform_config').select('commission_rate').eq('id', 1).single(),
            ]);

            // Get live commission rate from platform_config (fallback to 15%)
            const liveCommissionRate = configData?.commission_rate ?? 15;

            if (tripsError) throw tripsError;
            if (paymentsError) throw paymentsError;

            // Aggregate revenue from trip data (last 7 days chart)
            if (tripsData) {
                tripsData.forEach(trip => {
                    const dateStr = format(new Date(trip.created_at), 'MMM dd');
                    const tripRevenue = (trip.price_per_seat || 0) * (trip.seats_booked || 1);
                    if (revenueGrouped[dateStr] !== undefined) {
                        revenueGrouped[dateStr] += tripRevenue;
                    }
                });
            }

            // Aggregate financial metrics from ride_payments
            let totalCommission = 0;
            let totalDriverPay = 0;
            let totalGross = 0;

            if (paymentsData) {
                paymentsData.forEach(p => {
                    const comm = Number(p.commission_amount) || 0;
                    const driver = Number(p.driver_amount) || 0;
                    const total = Number(p.total_amount) || 0;

                    totalCommission += comm;
                    totalDriverPay += driver;
                    totalGross += total || (comm + driver);

                    // Commission chart data (last 7 days)
                    if (p.created_at) {
                        const dateStr = format(new Date(p.created_at), 'MMM dd');
                        if (commissionGrouped[dateStr] !== undefined) {
                            commissionGrouped[dateStr].commission += comm;
                            commissionGrouped[dateStr].driverPay += driver;
                        }
                    }
                });
            }

            const avgFare = (completedTripsCount || 0) > 0
                ? totalGross / completedTripsCount
                : 0;

            setFinancials({
                platformCommission: totalCommission,
                driverEarnings: totalDriverPay,
                grossTPV: totalGross,
                totalTrips: totalTripsCount || 0,
                completedTrips: completedTripsCount || 0,
                avgFarePerTrip: avgFare,
                totalPassengers: totalPassengers || 0,
                commissionRate: liveCommissionRate,
            });

            setChartData(
                Object.keys(revenueGrouped).map(key => ({ name: key, revenue: revenueGrouped[key] }))
            );
            setCommissionChartData(
                Object.keys(commissionGrouped).map(key => ({
                    name: key,
                    commission: commissionGrouped[key].commission,
                    driverPay: commissionGrouped[key].driverPay,
                }))
            );
        } catch (error) {
            console.error("Error fetching report data", error);
            toast.error("Failed to fetch analytics data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchReportData(); }, [fetchReportData]);

    // ─── CSV Export ──────────────────────────────────────────────────────
    const handleExportCSV = () => {
        const csvRows = [];
        csvRows.push(['Metric', 'Value'].join(','));
        csvRows.push(['Platform Commission (INR)', financials.platformCommission].join(','));
        csvRows.push(['Total Paid to Drivers (INR)', financials.driverEarnings].join(','));
        csvRows.push(['Gross TPV (INR)', financials.grossTPV].join(','));
        csvRows.push(['Total Trips', financials.totalTrips].join(','));
        csvRows.push(['Completed Trips', financials.completedTrips].join(','));
        csvRows.push(['Avg Fare Per Trip (INR)', financials.avgFarePerTrip.toFixed(2)].join(','));
        csvRows.push(['Total Passengers', financials.totalPassengers].join(','));
        csvRows.push(['Commission Rate (%)', financials.commissionRate].join(','));
        csvRows.push([]);
        csvRows.push(['Date', 'Revenue (INR)'].join(','));
        chartData.forEach(row => csvRows.push([row.name, row.revenue].join(',')));

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `xpool_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("Report downloaded successfully");
    };

    // ─── KPI Card Config ────────────────────────────────────────────────
    const kpiCards = [
        {
            label: 'Platform Commission',
            value: formatCurrency(financials.platformCommission),
            subtitle: `${financials.commissionRate}% of total volume`,
            icon: PiggyBank,
            color: 'text-violet-600',
            bg: 'bg-violet-50',
            borderColor: 'border-violet-100',
            accentGradient: 'from-violet-500 to-purple-600',
        },
        {
            label: 'Total Paid to Drivers',
            value: formatCurrency(financials.driverEarnings),
            subtitle: `${financials.completedTrips} completed trips`,
            icon: Wallet,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            borderColor: 'border-amber-100',
            accentGradient: 'from-amber-500 to-orange-500',
        },
        {
            label: 'Gross TPV',
            value: formatCurrency(financials.grossTPV),
            subtitle: 'Total payment volume',
            icon: Landmark,
            color: 'text-gray-700',
            bg: 'bg-gray-50',
            borderColor: 'border-gray-200',
            accentGradient: 'from-gray-600 to-gray-800',
        },
        {
            label: 'Avg Fare / Trip',
            value: formatCurrency(financials.avgFarePerTrip),
            subtitle: `Based on ${financials.completedTrips} trips`,
            icon: Receipt,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            borderColor: 'border-emerald-100',
            accentGradient: 'from-emerald-500 to-teal-500',
        },
    ];

    const statCards = [
        { label: 'Total Trips', value: financials.totalTrips, icon: Car, color: 'text-blue-500', bg: 'bg-blue-50' },
        { label: 'Completed', value: financials.completedTrips, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { label: 'Passengers', value: financials.totalPassengers, icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50' },
        { label: 'Comm. Rate', value: `${financials.commissionRate}%`, icon: CircleDollarSign, color: 'text-violet-500', bg: 'bg-violet-50' },
    ];

    // ─── Animation Variants ─────────────────────────────────────────────
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
    };
    const itemVariants = {
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
    };

    // ─── Custom Tooltip ─────────────────────────────────────────────────
    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="bg-white shadow-xl rounded-xl border border-gray-100 px-4 py-3 text-sm">
                <p className="text-xs font-bold text-gray-500 mb-1">{label}</p>
                {payload.map((entry, i) => (
                    <p key={i} className="font-bold" style={{ color: entry.color }}>
                        {entry.name}: {formatCurrency(entry.value)}
                    </p>
                ))}
            </div>
        );
    };

    return (
        <PageLayout color="amber">
            <div className="flex flex-col h-full bg-transparent overflow-y-auto">
                <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 pb-8">

                    {/* ── Header ────────────────────────────────────────── */}
                    <div className="flex items-center justify-between gap-4 mb-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-lg shadow-amber-200/40">
                                <BarChart2 className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-gray-900 tracking-tight">Analytics & Reports</h1>
                                <p className="text-xs text-gray-500 font-medium">Revenue, commission, and trip analytics</p>
                            </div>
                        </div>
                        <button
                            onClick={handleExportCSV}
                            className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-sm text-sm"
                        >
                            <Download size={16} />
                            Export CSV
                        </button>
                    </div>

                    {loading ? (
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <KPISkeleton key={i} />)}</div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><ChartSkeleton /><ChartSkeleton /></div>
                        </div>
                    ) : (
                        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">

                            {/* ── Financial KPI Cards ──────────────────────── */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {kpiCards.map((kpi, i) => (
                                    <motion.div
                                        key={i}
                                        variants={itemVariants}
                                        className={`bg-white rounded-2xl p-5 border ${kpi.borderColor} shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group`}
                                    >
                                        {/* Accent top bar */}
                                        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${kpi.accentGradient}`} />

                                        <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                                            <kpi.icon className={kpi.color} size={20} />
                                        </div>

                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                                        <p className={`text-2xl font-black ${kpi.color} tracking-tight leading-none mb-1`}>{kpi.value}</p>
                                        <p className="text-[11px] text-gray-400 font-medium">{kpi.subtitle}</p>
                                    </motion.div>
                                ))}
                            </div>

                            {/* ── Quick Stats Row ──────────────────────────── */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {statCards.map((stat, i) => (
                                    <motion.div
                                        key={i}
                                        variants={itemVariants}
                                        className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm flex items-center gap-3"
                                    >
                                        <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                                            <stat.icon className={stat.color} size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                                            <p className="text-lg font-black text-gray-900 leading-tight">{stat.value}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* ── Charts Grid ──────────────────────────────── */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                                {/* Revenue Chart */}
                                <motion.div variants={itemVariants} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={16} className="text-amber-500" />
                                            <h3 className="text-sm font-bold text-gray-900">Revenue (Last 7 Days)</h3>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 rounded-lg border border-amber-100">
                                            <IndianRupee size={11} className="text-amber-600" />
                                            <span className="text-[10px] font-bold text-amber-700">
                                                {formatCurrency(chartData.reduce((sum, d) => sum + d.revenue, 0))}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="h-[260px] w-full">
                                        <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
                                            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                                                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.7} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} dy={8} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(val) => `₹${val}`} />
                                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#fef3c7', radius: 8 }} />
                                                <Bar dataKey="revenue" name="Revenue" fill="url(#barGrad)" radius={[8, 8, 0, 0]} maxBarSize={42} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </motion.div>

                                {/* Commission vs Driver Payout Chart */}
                                <motion.div variants={itemVariants} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Banknote size={16} className="text-violet-500" />
                                            <h3 className="text-sm font-bold text-gray-900">Commission vs Payouts</h3>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                                                <span className="text-[10px] font-semibold text-gray-500">Commission</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                                <span className="text-[10px] font-semibold text-gray-500">Driver Pay</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="h-[260px] w-full">
                                        <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
                                            <AreaChart data={commissionChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="driverGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} dy={8} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(val) => `₹${val}`} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Area type="monotone" dataKey="commission" name="Commission" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#commGrad)" />
                                                <Area type="monotone" dataKey="driverPay" name="Driver Pay" stroke="#f59e0b" strokeWidth={2.5} fill="url(#driverGrad)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </motion.div>
                            </div>

                            {/* ── Financial Split Summary ──────────────────── */}
                            <motion.div variants={itemVariants} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <CircleDollarSign size={16} className="text-emerald-500" />
                                    Financial Split Summary
                                </h3>
                                <div className="flex items-center gap-3 mb-3">
                                    {/* Progress bar showing commission vs driver split */}
                                    <div className="flex-1 h-4 rounded-full overflow-hidden flex bg-gray-100">
                                        <div
                                            className="bg-gradient-to-r from-violet-500 to-purple-500 h-full transition-all duration-700 ease-out flex items-center justify-center"
                                            style={{ width: `${financials.grossTPV > 0 ? (financials.platformCommission / financials.grossTPV) * 100 : 15}%` }}
                                        >
                                            <span className="text-[8px] text-white font-bold">
                                                {financials.grossTPV > 0 ? Math.round((financials.platformCommission / financials.grossTPV) * 100) : 15}%
                                            </span>
                                        </div>
                                        <div
                                            className="bg-gradient-to-r from-amber-400 to-orange-400 h-full transition-all duration-700 ease-out flex items-center justify-center"
                                            style={{ width: `${financials.grossTPV > 0 ? (financials.driverEarnings / financials.grossTPV) * 100 : 85}%` }}
                                        >
                                            <span className="text-[8px] text-white font-bold">
                                                {financials.grossTPV > 0 ? Math.round((financials.driverEarnings / financials.grossTPV) * 100) : 85}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-0.5">Platform Share</p>
                                        <p className="text-lg font-black text-violet-700">{formatCurrency(financials.platformCommission)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-0.5">Driver Share</p>
                                        <p className="text-lg font-black text-amber-700">{formatCurrency(financials.driverEarnings)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Total Volume</p>
                                        <p className="text-lg font-black text-gray-800">{formatCurrency(financials.grossTPV)}</p>
                                    </div>
                                </div>
                            </motion.div>

                        </motion.div>
                    )}
                </div>
            </div>
        </PageLayout>
    );
}

export default Reports;
