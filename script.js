// CONFIG SUPABASE
const SUPABASE_URL = 'https://yefgcfewdmcrwgglausz.supabase.co';
const SUPABASE_KEY = 'sb_publishable__FjySgCRaX-NHkIt5Az7kw_q4OaQYWa';

// Inisialisasi Supabase Client yang aman
let supabase;
try {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
  console.error("Gagal load supabase:", e);
}

let currentUser = null;
let recognition = null;
let isRecording = false;

// TES TOMBOL DAFTAR DARURAT
async function handleRegister() {
  const usernameInput = document.getElementById('username').value.trim();
  const passwordInput = document.getElementById('password').value.trim();

  if (!usernameInput || !passwordInput) {
    alert('⚠️ Mohon isi Username dan Password dulu!');
    return;
  }

  alert('Tombol daftar diklik! Menghubungkan ke database...');

  if (!supabase) {
    alert('❌ Supabase belum siap!');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .insert([
        { 
          username: usernameInput, 
          password: passwordInput,
          name: usernameInput,
          role: 'kasir'
        }
      ]);

    if (error) {
      alert('Gagal ke database: ' + error.message);
    } else {
      alert('✅ Akun berhasil didaftarkan! Silakan klik Masuk.');
    }
  } catch (err) {
    alert('Terjadi kesalahan sistem: ' + err.message);
  }
}

async function handleLogin() {
  const usernameInput = document.getElementById('username').value.trim();
  const passwordInput = document.getElementById('password').value.trim();

  if (!usernameInput || !passwordInput) {
    alert('⚠️ Mohon isi Username dan Password!');
    return;
  }

  if (!supabase) {
    alert('❌ Supabase belum siap!');
    return;
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', usernameInput)
    .eq('password', passwordInput)
    .single();

  if (error || !user) {
    alert('❌ Username atau Password salah, atau belum terdaftar!');
    return;
  }

  currentUser = user;
  localStorage.setItem('catatan_user', JSON.stringify(currentUser));
  setupAppView();
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem('catatan_user');
  document.getElementById('auth-view').classList.add('active-view');
  document.getElementById('app-view').classList.remove('active-view');
}

function switchView(viewId) {
  const views = ['profile-view', 'kasir-view', 'koki-view'];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === viewId) ? 'block' : 'none';
  });
}

function backToMainDashboard() {
  if (currentUser?.role === 'koki') {
    switchView('koki-view');
  } else {
    switchView('kasir-view');
  }
}

function setupAppView() {
  document.getElementById('auth-view').classList.remove('active-view');
  document.getElementById('app-view').classList.add('active-view');

  document.getElementById('user-display-name').innerText = currentUser.name || currentUser.username;
  document.getElementById('user-role-badge').innerText = 'Role: ' + (currentUser.role ? currentUser.role.toUpperCase() : 'KASIR');
  if (currentUser.avatar) {
    document.getElementById('user-avatar').src = currentUser.avatar;
  }

  if (currentUser.role === 'koki') {
    switchView('koki-view');
    loadOrdersForKoki();
  } else {
    switchView('kasir-view');
    loadOrdersForKasir();
  }
}

async function saveProfile() {
  const name = document.getElementById('profile-name').value.trim();
  const role = document.getElementById('profile-role').value;
  const avatar = document.getElementById('profile-avatar').value.trim();

  const { error } = await supabase
    .from('users')
    .update({ name, role, avatar })
    .eq('id', currentUser.id);

  if (error) {
    alert('Gagal simpan profil: ' + error.message);
  } else {
    currentUser.name = name;
    currentUser.role = role;
    currentUser.avatar = avatar;
    localStorage.setItem('catatan_user', JSON.stringify(currentUser));
    alert('Profil berhasil diperbarui!');
    setupAppView();
  }
}

function toggleMic() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('Fitur suara tidak didukung di browser ini.');
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
    document.getElementById('mic-status').innerText = 'Merekam... Silakan bicara';
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

async function sendOrderToKoki() {
  const orderDetails = document.getElementById('order-input').value.trim();
  if (!orderDetails) {
    alert('Isi detail pesanan dulu!');
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
    alert('Gagal kirim pesanan: ' + error.message);
  } else {
    document.getElementById('order-input').value = '';
    alert('Pesanan terkirim!');
    loadOrdersForKasir();
  }
}

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
      <p><strong>Dari:</strong> ${item.kasir_name}</p>
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

async function updateOrderStatus(orderId, status) {
  await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId);

  loadOrdersForKoki();
}

window.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('catatan_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    setupAppView();
  }
});
