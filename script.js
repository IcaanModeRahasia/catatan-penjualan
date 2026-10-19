// CONFIG SUPABASE
const SUPABASE_URL = 'https://yefgcfewdmcrwgglausz.supabase.co';
const SUPABASE_KEY = 'sb_publishable__FjySgCRaX-NHkIt5Az7kw_q4OaQYWa';

// Inisialisasi Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Global User State
let currentUser = null;
let recognition = null;
let isRecording = false;

// 1. FUNGSI REGISTRASI AKUN BARU
async function handleRegister() {
  const usernameInput = document.getElementById('username').value.trim();
  const passwordInput = document.getElementById('password').value.trim();

  if (!usernameInput || !passwordInput) {
    alert('Mohon isi Username dan Password terlebih dahulu!');
    return;
  }

  // Cek apakah username sudah dipakai
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('username', usernameInput)
    .single();

  if (existingUser) {
    alert('Username ini sudah terdaftar! Gunakan username lain.');
    return;
  }

  // Simpan akun baru ke tabel users
  const { data, error } = await supabase
    .from('users')
    .insert([
      { 
        username: usernameInput, 
        password: passwordInput,
        name: usernameInput
      }
    ]);

  if (error) {
    alert('Gagal pendaftaran: ' + error.message);
  } else {
    alert('Akun berhasil dibuat! Silakan klik tombol "Masuk (Login)".');
  }
}

// 2. FUNGSI LOGIN AKUN
async function handleLogin() {
  const usernameInput = document.getElementById('username').value.trim();
  const passwordInput = document.getElementById('password').value.trim();

  if (!usernameInput || !passwordInput) {
    alert('Mohon isi Username dan Password!');
    return;
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', usernameInput)
    .eq('password', passwordInput)
    .single();

  if (error || !user) {
    alert('Username atau Password salah!');
    return;
  }

  currentUser = user;
  localStorage.setItem('catatan_user', JSON.stringify(currentUser));
  setupAppView();
}

// 3. FUNGSI KELUAR / LOGOUT
function handleLogout() {
  currentUser = null;
  localStorage.removeItem('catatan_user');
  document.getElementById('auth-view').classList.add('active-view');
  document.getElementById('app-view').classList.remove('active-view');
}

// 4. NAVIGASI VIEW
function switchView(viewId) {
  const views = ['profile-view', 'kasir-view', 'koki-view'];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === viewId) ? 'block' : 'none';
  });
}

function backToMainDashboard() {
  if (currentUser.role === 'koki') {
    switchView('koki-view');
  } else {
    switchView('kasir-view');
  }
}

// 5. SETUP DASHBOARD UTAMA
function setupAppView() {
  document.getElementById('auth-view').classList.remove('active-view');
  document.getElementById('app-view').classList.add('active-view');

  // Update profil header
  document.getElementById('user-display-name').innerText = currentUser.name || currentUser.username;
  document.getElementById('user-role-badge').innerText = 'Role: ' + (currentUser.role ? currentUser.role.toUpperCase() : 'KASIR');
  if (currentUser.avatar) {
    document.getElementById('user-avatar').src = currentUser.avatar;
  }

  // Tampilkan dashboard sesuai role
  if (currentUser.role === 'koki') {
    switchView('koki-view');
    loadOrdersForKoki();
  } else {
    switchView('kasir-view');
    loadOrdersForKasir();
  }

  listenRealtimeOrders();
}

// 6. SIMPAN PROFIL
async function saveProfile() {
  const name = document.getElementById('profile-name').value.trim();
  const role = document.getElementById('profile-role').value;
  const avatar = document.getElementById('profile-avatar').value.trim();

  const { error } = await supabase
    .from('users')
    .update({ name, role, avatar })
    .eq('id', currentUser.id);

  if (error) {
    alert('Gagal menyimpan profil: ' + error.message);
  } else {
    currentUser.name = name;
    currentUser.role = role;
    currentUser.avatar = avatar;
    localStorage.setItem('catatan_user', JSON.stringify(currentUser));
    alert('Profil berhasil diperbarui!');
    setupAppView();
  }
}

// 7. INPUT PESANAN SUARA (MIC)
function toggleMic() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('Fitur perekam suara tidak didukung di browser ini.');
    return;
  }

  if (isRecording) {
    recognition.stop();
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'id-ID';

  recognition.onstart = () => {
    isRecording = true;
    document.getElementById('mic-status').innerText = 'Merekam... Silakan bicara pesanan';
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById('order-input').value = transcript;
  };

  recognition.onend = () => {
    isRecording = false;
    document.getElementById('mic-status').innerText = '';
  };

  recognition.start();
}

// 8. KIRIM PESANAN KE KOKI
async function sendOrderToKoki() {
  const orderDetails = document.getElementById('order-input').value.trim();
  if (!orderDetails) {
    alert('Isi detail pesanan terlebih dahulu!');
    return;
  }

  const { error } = await supabase
    .from('orders')
    .insert([
      {
        kasir_name: currentUser.name || currentUser.username,
        details: orderDetails,
        status: 'pending'
      }
    ]);

  if (error) {
    alert('Gagal mengirim pesanan: ' + error.message);
  } else {
    document.getElementById('order-input').value = '';
    alert('Pesanan berhasil dikirim ke Koki!');
    loadOrdersForKasir();
  }
}

// 9. BACA PESANAN UNTUK KASIR
async function loadOrdersForKasir() {
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  const listContainer = document.getElementById('kasir-order-list');
  if (!listContainer) return;

  listContainer.innerHTML = '';
  (orders || []).forEach(item => {
    const card = document.createElement('div');
    card.className = `order-card ${item.status}`;
    card.innerHTML = `
      <p><strong>Pesanan:</strong> ${item.details}</p>
      <span class="badge ${item.status}">${item.status.toUpperCase()}</span>
    `;
    listContainer.appendChild(card);
  });
}

// 10. BACA PESANAN UNTUK KOKI
async function loadOrdersForKoki() {
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  const listContainer = document.getElementById('koki-order-list');
  if (!listContainer) return;

  listContainer.innerHTML = '';
  (orders || []).forEach(item => {
    const card = document.createElement('div');
    card.className = `order-card ${item.status}`;
    card.innerHTML = `
      <p><strong>Dari Kasir:</strong> ${item.kasir_name}</p>
      <p><strong>Pesanan:</strong> ${item.details}</p>
      <p><strong>Status:</strong> <span class="badge ${item.status}">${item.status.toUpperCase()}</span></p>
      ${item.status === 'pending' ? `
        <div class="btn-group" style="margin-top: 10px;">
          <button class="btn-accept" onclick="updateOrderStatus('${item.id}', 'accepted')">Terima 👍</button>
          <button class="btn-reject" onclick="updateOrderStatus('${item.id}', 'rejected')">Tolak 👎</button>
        </div>
      ` : ''}
    `;
    listContainer.appendChild(card);
  });
}

// 11. UPDATE STATUS PESANAN OLEH KOKI
async function updateOrderStatus(orderId, status) {
  await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId);

  loadOrdersForKoki();
}

// 12. UPDATE REALTIME DARI DATABASE
function listenRealtimeOrders() {
  supabase
    .channel('orders-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
      if (currentUser?.role === 'koki') {
        loadOrdersForKoki();
      } else {
        loadOrdersForKasir();
      }
    })
    .subscribe();
}

// AUTO CHECK REFRESH LOGIN
window.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('catatan_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    setupAppView();
  }
});
