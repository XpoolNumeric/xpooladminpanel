import { useEffect } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { ShieldAlert, BellRing } from 'lucide-react';
import React from 'react';

// This is a headless component that listens to DB changes and triggers toasts
function AdminNotifications() {
    useEffect(() => {
        // Listen to trips table for new trips or cancelled trips
        const tripSub = supabase.channel('notify-trips')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trips' }, (payload) => {
                toast.custom((t) => (
                    <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
                        <div className="flex-1 w-0 p-4">
                            <div className="flex items-start">
                                <div className="flex-shrink-0 pt-0.5">
                                    <BellRing className="h-10 w-10 p-2 bg-emerald-100 text-emerald-500 rounded-full" />
                                </div>
                                <div className="ml-3 flex-1">
                                    <p className="text-sm font-bold text-gray-900">New Trip Requested!</p>
                                    <p className="mt-1 text-xs text-gray-500 font-medium">Trip from {payload.new.source} to {payload.new.destination}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ), { duration: 5000 });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: 'status=eq.cancelled' }, (payload) => {
                toast.custom((t) => (
                    <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
                        <div className="flex-1 w-0 p-4">
                            <div className="flex items-start">
                                <div className="flex-shrink-0 pt-0.5">
                                    <ShieldAlert className="h-10 w-10 p-2 bg-red-100 text-red-500 rounded-full" />
                                </div>
                                <div className="ml-3 flex-1">
                                    <p className="text-sm font-bold text-gray-900">Trip Cancelled</p>
                                    <p className="mt-1 text-xs text-gray-500 font-medium">A trip needs attention.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ), { duration: 5000 });
            })
            .subscribe();

        // Listen to drivers table
        const driverSub = supabase.channel('notify-drivers')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'drivers' }, (payload) => {
                toast.success('New driver application received!');
            })
            .subscribe();

        return () => {
            supabase.removeChannel(tripSub);
            supabase.removeChannel(driverSub);
        };
    }, []);

    return null; // Headless component
}

export default AdminNotifications;
