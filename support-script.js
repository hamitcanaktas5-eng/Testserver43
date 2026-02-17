// support-script.js
var suppUser     = null;
var suppUserData = null;
var currentTicketId = null;

requireAuth(function(user) {
    suppUser = user;
    db.collection('users').doc(user.uid).get().then(function(snap) {
        suppUserData = snap.exists ? snap.data() : { balance: 0 };
        var name    = suppUserData.name || user.displayName || 'Kullanıcı';
        var balance = suppUserData.balance || 0;

        var balEl = document.querySelector('.balance-amount, #userBalanceDisplay');
        if (balEl) balEl.textContent = formatPrice(balance);

        var avatarImg  = document.querySelector('.user-avatar img');
        var avatarSpan = document.querySelector('.user-avatar span');
        if (avatarImg)  avatarImg.src         = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=00D9FF&color=fff';
        if (avatarSpan) avatarSpan.textContent = name;

        loadTickets(user.uid);
    });
});

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    var o = document.getElementById('overlay');
    if (o) o.classList.toggle('active');
}

function loadTickets(uid) {
    var container = document.getElementById('ticketList');
    if (!container) return;

    db.collection('tickets')
        .where('userId', '==', uid)
        .get().then(function(snap) {
            if (snap.empty) {
                container.innerHTML = '<div style="text-align:center;padding:40px;color:#A0A0B8"><i class="fas fa-headset" style="font-size:36px;opacity:.25;display:block;margin-bottom:12px"></i><p>Henüz destek talebi yok</p></div>';
                return;
            }
            var html = '';
            snap.forEach(function(doc) {
                var t  = doc.data();
                var id = doc.id;
                var isOpen = t.status === 'open';
                html += '<div class="ticket-item" onclick="openChat(\'' + id + '\')" style="cursor:pointer;">'
                    + '<div class="ticket-top"><span class="ticket-id">' + (t.ticketId||id) + '</span>'
                    + '<span class="ticket-badge ' + (isOpen?'badge-open':'badge-closed') + '">'
                    + '<span class="dot ' + (isOpen?'dot-open':'dot-closed') + '"></span>'
                    + (isOpen?'Açık':'Kapalı') + '</span></div>'
                    + '<div class="ticket-title">' + t.title + '</div>'
                    + '<div class="ticket-date">' + fmtDate(t.createdAt) + '</div>'
                    + '</div>';
            });
            container.innerHTML = html;
        }).catch(function(e) { console.error(e); });
}

function showNewTicketForm() {
    var modal = document.getElementById('newTicketModal');
    if (modal) modal.style.display = 'flex';
}
function hideNewTicketForm() {
    var modal = document.getElementById('newTicketModal');
    if (modal) modal.style.display = 'none';
    ['ticketTitle','ticketCategory','ticketMessage'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
}

function submitTicket() {
    var title    = (document.getElementById('ticketTitle').value || '').trim();
    var category = (document.getElementById('ticketCategory').value || '').trim();
    var message  = (document.getElementById('ticketMessage').value || '').trim();

    if (!title || !category || !message) {
        RoxyUI.alert('Eksik Bilgi', 'Tüm alanları doldurun.', 'warning');
        return;
    }

    // Kaçıncı ticket olduğunu bul
    db.collection('tickets').where('userId','==',suppUser.uid).get().then(function(snap) {
        var count    = snap.size + 1;
        var ticketId = generateTKTId(count);

        return db.collection('tickets').doc(ticketId).set({
            ticketId:  ticketId,
            userId:    suppUser.uid,
            userEmail: suppUser.email,
            userName:  (suppUserData && suppUserData.name) ? suppUserData.name : '',
            title:     title,
            category:  category,
            status:    'open',
            messages:  [{ sender:'user', text:message, timestamp: new Date().toISOString() }],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }).then(function() {
        hideNewTicketForm();
        RoxyUI.toast('Talebiniz oluşturuldu!', 'success', 4000);
        loadTickets(suppUser.uid);
    }).catch(function(e) {
        RoxyUI.alert('Hata', 'Talep oluşturulamadı: ' + e.message, 'error');
    });
}

function openChat(docId) {
    currentTicketId = docId;
    db.collection('tickets').doc(docId).get().then(function(snap) {
        var t = snap.data();

        var titleEl = document.getElementById('chatTitle');
        var statusEl = document.getElementById('chatStatus');
        if (titleEl)  titleEl.textContent  = t.title;
        if (statusEl) statusEl.textContent = t.status === 'open' ? '🟢 Açık' : '⚫ Kapalı';

        renderMessages(t.messages || []);

        var input = document.getElementById('messageInput');
        var btn   = document.getElementById('sendMsgBtn');
        if (input) input.disabled = t.status !== 'open';
        if (btn)   btn.disabled   = t.status !== 'open';

        var mainView = document.getElementById('mainView');
        var chatView = document.getElementById('chatView');
        if (mainView) mainView.style.display = 'none';
        if (chatView) chatView.style.display = 'block';
    }).catch(function(e) { console.error(e); });
}

function renderMessages(messages) {
    var container = document.getElementById('chatMessages');
    if (!container) return;
    if (!messages || !messages.length) {
        container.innerHTML = '<p style="text-align:center;color:#A0A0B8;padding:20px">Mesaj yok</p>';
        return;
    }
    container.innerHTML = messages.map(function(m) {
        var isUser = m.sender === 'user';
        return '<div class="msg ' + (isUser ? 'msg-user' : 'msg-admin') + '">'
            + '<div class="msg-bubble">' + m.text + '</div>'
            + '<div class="msg-time">' + (m.timestamp ? new Date(m.timestamp).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}) : '') + '</div>'
            + '</div>';
    }).join('');
    container.scrollTop = container.scrollHeight;
}

function sendMessage() {
    if (!currentTicketId) return;
    var input = document.getElementById('messageInput');
    var text  = (input ? input.value : '').trim();
    if (!text) return;

    var msg = { sender:'user', text:text, timestamp: new Date().toISOString() };
    db.collection('tickets').doc(currentTicketId).update({
        messages: firebase.firestore.FieldValue.arrayUnion(msg)
    }).then(function() {
        if (input) input.value = '';
        return db.collection('tickets').doc(currentTicketId).get();
    }).then(function(snap) {
        renderMessages(snap.data().messages || []);
    }).catch(function(e) { console.error(e); });
}

function closeChat() {
    var mainView = document.getElementById('mainView');
    var chatView = document.getElementById('chatView');
    if (chatView) chatView.style.display = 'none';
    if (mainView) mainView.style.display = 'block';
    currentTicketId = null;
}
