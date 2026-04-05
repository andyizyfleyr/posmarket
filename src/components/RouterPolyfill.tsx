'use client';

import React from 'react';
import { useRouter as useNextRouter, usePathname as useNextPathname, useParams as useNextParams, useSearchParams as useNextSearchParams, redirect } from 'next/navigation';
import NextLink from 'next/link';

// Essential Next.js hooks direct exports
export { redirect };
export const useRouter = useNextRouter;
export const usePathname = useNextPathname;
export const useSearchParams = useNextSearchParams;

// Polyfills for React Router Dom
export const useNavigate = () => {
    const router = useNextRouter();
    return (path: string | number) => {
        if (typeof path === 'number') {
            if (path < 0) router.back();
            else router.forward();
        } else {
            router.push(path);
        }
    };
};

export const useLocation = () => {
    const pathname = useNextPathname();
    const searchParams = useNextSearchParams();
    return {
        pathname: pathname || '',
        search: searchParams?.toString() || '',
        hash: '',
        state: null,
        key: 'default'
    };
};

export const useParams = () => {
    const params = useNextParams();
    return params || {};
};

export const useMatch = (pattern: string) => {
    const pathname = useNextPathname();
    if (!pathname) return null;
    
    // Simple polyfill for /store/:param or /product/:param
    if (pattern.includes(':')) {
        const parts = pattern.split('/').filter(Boolean);
        const pathParts = pathname.split('/').filter(Boolean);
        if (parts.length !== pathParts.length) return null;

        const params: Record<string, string> = {};
        for (let i = 0; i < parts.length; i++) {
            if (parts[i].startsWith(':')) {
                params[parts[i].slice(1)] = pathParts[i];
            } else if (parts[i] !== pathParts[i]) {
                return null;
            }
        }
        return { params };
    }
    return pathname === pattern ? { params: {} } : null;
};

export const Link = React.forwardRef<HTMLAnchorElement, any>((props, ref) => {
    const { to, href, ...rest } = props;
    return <NextLink href={to || href || '#'} ref={ref} {...rest} />;
});

export const Routes = ({ children }: { children: React.ReactNode }) => {
    const pathname = useNextPathname() || '/';
    const childrenArray = React.Children.toArray(children);
    
    // Find the first matching child
    for (const child of childrenArray) {
        if (React.isValidElement(child)) {
            const { path, index } = child.props as any;
            
            if (index && pathname === '/') return <>{child}</>;
            
            if (path) {
                // simple /store/:param matching
                const pattern = path.startsWith('/') ? path : `/${path}`;
                const regexPattern = pattern
                    .replace(/:[^\/]+/g, '([^/]+)')
                    .replace(/\//g, '\\/');
                const regex = new RegExp(`^${regexPattern}$`);
                
                if (regex.test(pathname)) return <>{child}</>;
            }
        }
    }
    
    return null;
};

export const Route = (props: { element: React.ReactNode, path?: string, index?: boolean }) => {
    return <>{props.element}</>;
};
