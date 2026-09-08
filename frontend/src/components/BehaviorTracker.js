/**
 * BehaviorTracker.js
 * Collects browser-level behavior signals:
 *  - Mouse idle time
 *  - Tab visibility switches
 *  - Response start time (to calculate responseTime)
 *
 * Usage:
 *   import BehaviorTracker from './BehaviorTracker';
 *   const tracker = new BehaviorTracker(onViolation);
 *   tracker.start();
 *   const metrics = tracker.getMetrics();
 *   tracker.stop();
 */

export default class BehaviorTracker {
    constructor(onViolation) {
        this._onViolation = onViolation;
        this._mouseIdleTime = 0;
        this._tabSwitches = 0;
        this._fullscreenExits = 0;
        this._lastMouseMove = Date.now();
        this._questionStart = Date.now();
        this._idleTimer = null;
        this._handleMouse = this._handleMouse.bind(this);
        this._handleVisibility = this._handleVisibility.bind(this);
        this._handleFullscreen = this._handleFullscreen.bind(this);
        this._handleResize = this._handleResize.bind(this);
    }

    start() {
        this._questionStart = Date.now();
        this._lastMouseMove = Date.now();
        document.addEventListener('mousemove', this._handleMouse);
        document.addEventListener('visibilitychange', this._handleVisibility);
        document.addEventListener('fullscreenchange', this._handleFullscreen);
        window.addEventListener('resize', this._handleResize);
        // Poll idle time every second
        this._idleTimer = setInterval(() => {
            const now = Date.now();
            const idleSec = (now - this._lastMouseMove) / 1000;
            this._mouseIdleTime = Math.round(idleSec);
        }, 1000);
    }

    stop() {
        document.removeEventListener('mousemove', this._handleMouse);
        document.removeEventListener('visibilitychange', this._handleVisibility);
        document.removeEventListener('fullscreenchange', this._handleFullscreen);
        window.removeEventListener('resize', this._handleResize);
        clearInterval(this._idleTimer);
    }

    resetQuestion() {
        this._questionStart = Date.now();
        this._mouseIdleTime = 0;
        this._lastMouseMove = Date.now();
    }

    _handleMouse() {
        this._lastMouseMove = Date.now();
        this._mouseIdleTime = 0;
    }

    _handleVisibility() {
        if (document.hidden) {
            this._tabSwitches += 1;
            this._onViolation?.({ type: 'tab', count: this._tabSwitches });
        }
    }

    _handleFullscreen() {
        if (!document.fullscreenElement) {
            this._fullscreenExits += 1;
            this._onViolation?.({ type: 'fullscreen', count: this._fullscreenExits });
        }
    }

    _handleResize() {
        if (!document.fullscreenElement) {
            this._onViolation?.({ type: 'resize', count: 1 });
        }
    }

    getMetrics() {
        const responseTime = Math.round((Date.now() - this._questionStart) / 1000);
        return {
            mouseIdleTime: this._mouseIdleTime,
            responseTime,
            tabSwitches: this._tabSwitches,
            fullscreenExits: this._fullscreenExits,
        };
    }

    getTabSwitches() { return this._tabSwitches; }
    getFullscreenExits() { return this._fullscreenExits; }
}

