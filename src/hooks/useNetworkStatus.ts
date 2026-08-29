import { useState, useEffect } from 'react';

type NetworkInformation = {
  effectiveType?: string;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
};

export const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(true);
    const [isSlow, setIsSlow] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const updateStatus = () => {
            setIsOnline(navigator.onLine);
            
            // Check for connection speed if supported
            const nav = navigator as NavigatorWithConnection;
            const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
            if (conn) {
                const isSlowConn = !!conn.effectiveType && ['slow-2g', '2g', '3g'].includes(conn.effectiveType);
                setIsSlow(isSlowConn);
                
                const onConnChange = () => {
                    setIsSlow(!!conn.effectiveType && ['slow-2g', '2g', '3g'].includes(conn.effectiveType));
                };
                conn.addEventListener?.('change', onConnChange);
                return () => conn.removeEventListener?.('change', onConnChange);
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
