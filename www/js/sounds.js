window.playSound = (function () {
    let ctx = null;
    let _volume = 1.0;
    let _muted = false;

    function getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function tone(freq, dur, type, gain, offset) {
        if (_muted) return;
        const c = getCtx();
        const t = c.currentTime + (offset || 0);
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.connect(g);
        g.connect(c.destination);
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime((gain || 0.25) * _volume, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t);
        osc.stop(t + dur);
    }

    const sounds = {
        colocar:  () => tone(520, 0.09, 'sine', 0.22),
        victoria: () => {
            tone(523, 0.12, 'sine', 0.30, 0.00);
            tone(659, 0.12, 'sine', 0.30, 0.13);
            tone(784, 0.28, 'sine', 0.35, 0.26);
        },
        empate: () => {
            tone(440, 0.14, 'sine', 0.20, 0.00);
            tone(392, 0.26, 'sine', 0.14, 0.17);
        }
    };

    window.setSoundVolume = function (v) { _volume = Math.max(0, Math.min(1, v)); };
    window.setSoundMuted  = function (m) { _muted = !!m; };
    window.setTema        = function (t) { document.documentElement.setAttribute('data-tema', t); };

    return function (name) {
        try { if (sounds[name]) sounds[name](); }
        catch (e) { /* AudioContext bloqueado */ }
    };
})();
