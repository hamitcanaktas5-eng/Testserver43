// balance-script.js
var balUser     = null;
var balUserData = null;

requireAuth(function(user) {
    balUser = user;
    db.collection('users').doc(user.uid).get().then(function(snap) {
        balUserData = snap.exists ? snap.data() : { balance: 0 };
        var name    = balUserData.name || user.displayName || 'Kullanıcı';
        var balance = balUserData.balance || 0;

        var balEl = document.querySelector('.balance-amount, #userBalanceDisplay');
        if (balEl) balEl.textContent = formatPrice(balance);

        var avatarImg  = document.querySelector('.user-avatar img');
        var avatarSpan = document.querySelector('.user-avatar span');
        if (avatarImg)  avatarImg.src         = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=00D9FF&color=fff';
        if (avatarSpan) avatarSpan.textContent = name;

        loadBalanceHistory(user.uid);
    });
});

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    var o = document.getElementById('overlay');
    if (o) o.classList.toggle('active');
}

function checkTransferForm() {
    var amount = parseInt(document.getElementById('transferAmount').value) || 0;
    var txId   = (document.getElementById('transactionId').value || '').trim();
    var btn    = document.getElementById('btnConfirmTransfer');
    if (btn) btn.disabled = !(amount >= 10 && txId.length >= 4);
}

function confirmTransfer() {
    var amount = parseInt(document.getElementById('transferAmount').value) || 0;
    var txId   = (document.getElementById('transactionId').value || '').trim();
    if (amount < 10 || txId.length < 4) return;

    RoxyUI.confirm(
        'Bakiye Talebi',
        'Tutar: <strong>' + formatPrice(amount) + '</strong><br>' +
        'İşlem No: <strong>' + txId + '</strong><br><br>' +
        'Papara\'ya transfer yaptıktan sonra bu formu gönderin.<br>Admin onayladıktan sonra bakiyeniz yüklenecektir.',
        'Talebi Gönder', 'İptal'
    ).then(function(ok) {
        if (!ok) return;

        var btn = document.getElementById('btnConfirmTransfer');
        if (btn) { btn.disabled = true; btn.textContent = 'Gönderiliyor...'; }

        var reqId = 'BAL-' + Date.now();
        db.collection('balance_requests').doc(reqId).set({
            requestId:     reqId,
            userId:        balUser.uid,
            userEmail:     balUser.email,
            userName:      (balUserData && balUserData.name) ? balUserData.name : '',
            amount:        amount,
            transactionId: txId,
            status:        'pending',
            createdAt:     firebase.firestore.FieldValue.serverTimestamp()
        }).then(function() {
            document.getElementById('transferAmount').value = '';
            document.getElementById('transactionId').value  = '';
            if (btn) { btn.disabled = true; btn.textContent = 'Talebi Gönder'; }
            RoxyUI.toast('Talebiniz alındı! Admin onayladıktan sonra bakiyeniz yüklenecektir.', 'success', 6000);
            loadBalanceHistory(balUser.uid);
        }).catch(function(e) {
            if (btn) { btn.disabled = false; btn.textContent = 'Talebi Gönder'; }
            RoxyUI.alert('Hata', 'Talep gönderilemedi: ' + e.message, 'error');
        });
    });
}

function loadBalanceHistory(uid) {
    var container = document.getElementById('balanceHistory');
    if (!container) return;

    db.collection('balance_requests')
        .where('userId', '==', uid)
        .get().then(function(snap) {
            if (snap.empty) {
                container.innerHTML = '<div class="empty-history" style="text-align:center;padding:30px;color:#A0A0B8"><i class="fas fa-history" style="font-size:28px;opacity:.3;display:block;margin-bottom:10px"></i>Henüz bakiye talebi yok</div>';
                return;
            }
            var html = '';
            snap.forEach(function(doc) {
                var r = doc.data();
                var statusMap = {
                    pending:  { icon:'⏳', label:'Beklemede', color:'#FFB347' },
                    approved: { icon:'✅', label:'Onaylandı',  color:'#00FF88' },
                    rejected: { icon:'❌', label:'Reddedildi', color:'#FF6584' }
                };
                var st = statusMap[r.status] || statusMap.pending;
                html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">'
                    + '<div><div style="font-weight:700">' + formatPrice(r.amount) + '</div>'
                    + '<div style="font-size:12px;color:#A0A0B8;margin-top:2px">İşlem No: ' + r.transactionId + '</div>'
                    + '<div style="font-size:11px;color:#A0A0B8">' + fmtDate(r.createdAt) + '</div></div>'
                    + '<div style="color:' + st.color + ';font-weight:700;font-size:13px">' + st.icon + ' ' + st.label + '</div>'
                    + '</div>';
            });
            container.innerHTML = '<div style="border-radius:12px;border:1px solid rgba(0,217,255,0.12);overflow:hidden">' + html + '</div>';
        }).catch(function(e) { console.log('Geçmiş yüklenemedi:', e); });
}
