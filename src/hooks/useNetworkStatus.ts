import { useState, useEffect } from 'react';

export const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(true);
    const [isSlow, setIsSlow] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const updateStatus = () => {
            setIsOnline(navigator.onLine);
            
            // Check for connection speed if supported
            const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
            if (conn) {
                const isSlowConn = ['slow-2g', '2g', '3g'].includes(conn.effectiveType);
                setIsSlow(isSlowConn);
                
                const onConnChange = () => {
                    setIsSlow(['slow-2g', '2g', '3g'].includes(conn.effectiveType));
                };
                conn.addEventListener('change', onConnChange);
                return () => conn.removeEventListener('change', onConnChange);
            }
        };

        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
        updateStatus();

        return () => {
            window.removeEventListener('online', updateStatus);
            window.removeEventListener('offline', updateStatus);
        };
    }, []);

    return { isOnline, isSlow };
};
