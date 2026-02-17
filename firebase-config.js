// firebase-config.js
(function() {
    if (!firebase.apps.length) {
        firebase.initializeApp({
            apiKey:            "AIzaSyBf2A1GhEzruI_6lfCNbq4MsbU8hxFjoqI",
            authDomain:        "roxy-store-67c53.firebaseapp.com",
            projectId:         "roxy-store-67c53",
            storageBucket:     "roxy-store-67c53.firebasestorage.app",
            messagingSenderId: "450502544206",
            appId:             "1:450502544206:web:502d0200dc35ecacfc2c1f"
        });
    }
})();

var auth = firebase.auth();
var db   = firebase.firestore();

// Auth guard - TEK SEFERLIK, token yenilemesinde tetiklenmez
function requireAuth(callback) {
    var unsub = auth.onAuthStateChanged(function(user) {
        unsub(); // İlk tepkiden sonra durdur
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }
        callback(user);
    });
}

function formatPrice(n) {
    return Math.round(n || 0).toLocaleString('tr-TR') + ' ₺';
}

function fmtDate(ts) {
    if (!ts) return '—';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('tr-TR') + ' ' +
           d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function isWorkingHours() {
    var now = new Date(), day = now.getDay(), h = now.getHours();
    return day === 0 || day === 6 || h >= 17;
}
