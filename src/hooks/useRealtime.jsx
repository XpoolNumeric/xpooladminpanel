import { useEffect } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

export const useRealtime = (table, onUpdate) => {
    useEffect(() => {
        const subscription = supabase.channel(`public:${table}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: table }, (payload) => {
                console.log(`Realtime update on ${table}`, payload);
                if (onUpdate) {
                    onUpdate(payload);
                } else {
                    toast.success(`${table} updated!`);
                }
            })
            .subscribe((status) => {
                if(status === 'SUBSCRIBED') {
                    console.log(`Subscribed to ${table}`);
                }
            });

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [table, onUpdate]);
};
