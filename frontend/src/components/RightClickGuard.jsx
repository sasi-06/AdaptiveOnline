import React, { useState, useEffect } from 'react';

/**
 * RightClickGuard
 * Prevents default right-click context menu across the application
 * and displays a floating warning toast notification "Right click is disabled".
 */
export default function RightClickGuard({ children }) {
    const [toast, setToast] = useState(null);

    useEffect(() => {
        const handleContextMenu = (e) => {
            e.preventDefault();
            
            // Trigger warning toast notification
            setToast({
                id: Date.now(),
                x: e.clientX,
                y: e.clientY
            });
        };

        window.addEventListener('contextmenu', handleContextMenu);
        return () => window.removeEventListener('contextmenu', handleContextMenu);
    }, []);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 2200);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    return (
        <>
            {children}
            {toast && (
                <div style={styles.toastOverlay}>
                    <div style={styles.toastBox}>
                        <span style={styles.icon}>🚫</span>
                        <span style={styles.text}>Right click is disabled</span>
                    </div>
                </div>
            )}
        </>
    );
}

const styles = {
    toastOverlay: {
        position: 'fixed',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999999,
        pointerEvents: 'none',
        animation: 'fadeInDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    },
    toastBox: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(15, 23, 42, 0.96)',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        boxShadow: '0 10px 30px rgba(239, 68, 68, 0.25), 0 4px 12px rgba(0, 0, 0, 0.5)',
        borderRadius: '30px',
        padding: '10px 22px',
        color: '#ffffff',
        fontFamily: 'Outfit, system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '0.3px',
        backdropFilter: 'blur(12px)',
    },
    icon: {
        fontSize: '16px',
    },
    text: {
        color: '#f87171',
    }
};
