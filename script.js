let currentIdentifier = '';

function showAlert(message, type = 'error') {
  const alertEl = document.getElementById('alert');
  alertEl.className = `alert ${type}`;
  alertEl.innerText = message;
  alertEl.classList.remove('hidden');
}

function hideAlert() {
  document.getElementById('alert').classList.add('hidden');
}

function switchTab(tab) {
  hideAlert();
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('otp-form').classList.add('hidden');
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('dashboard').classList.add('hidden');

  if (tab === 'register') {
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.getElementById('register-form').classList.remove('hidden');
    document.getElementById('sub-title').innerText = 'Create an account to get started';
  } else if (tab === 'login') {
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('sub-title').innerText = 'Enter credentials to access account';
  }
}

// 1. REGISTER
async function handleRegister(e) {
  e.preventDefault();
  hideAlert();
  const inputVal = document.getElementById('reg-identifier').value.trim();
  const password = document.getElementById('reg-password').value;

  const isEmail = inputVal.includes('@');
  const payload = {
    password,
    [isEmail ? 'email' : 'phone']: inputVal
  };

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Registration failed');

    currentIdentifier = inputVal;
    showAlert(data.message, 'success');

    // Switch to OTP Form
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('tab-buttons').classList.add('hidden');
    document.getElementById('otp-form').classList.remove('hidden');
    document.getElementById('sub-title').innerText = `Enter OTP sent to ${currentIdentifier}`;

    if (data.otpDemo) {
      document.getElementById('demo-otp-val').innerText = data.otpDemo;
      document.getElementById('demo-otp-box').classList.remove('hidden');
    }
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

// 2. VERIFY OTP
async function handleVerifyOTP(e) {
  e.preventDefault();
  hideAlert();
  const otp = document.getElementById('otp-code').value.trim();

  const isEmail = currentIdentifier.includes('@');
  const payload = {
    otp,
    [isEmail ? 'email' : 'phone']: currentIdentifier
  };

  try {
    const res = await fetch('/api/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Verification failed');

    showAlert(data.message, 'success');
    document.getElementById('tab-buttons').classList.remove('hidden');
    switchTab('login');
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

// 3. LOGIN
async function handleLogin(e) {
  e.preventDefault();
  hideAlert();
  const inputVal = document.getElementById('login-identifier').value.trim();
  const password = document.getElementById('login-password').value;

  const isEmail = inputVal.includes('@');
  const payload = {
    password,
    [isEmail ? 'email' : 'phone']: inputVal
  };

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Login failed');

    localStorage.setItem('jwtToken', data.token);
    showAlert('Login successful!', 'success');
    loadProfile(data.token);
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

// 4. LOAD PROTECTED PROFILE
async function loadProfile(token) {
  try {
    const res = await fetch('/api/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('tab-buttons').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('sub-title').innerText = 'User Account Dashboard';

    document.getElementById('user-id').innerText = data.user._id;
    document.getElementById('user-identifier').innerText = data.user.email || data.user.phone;
  } catch (err) {
    showAlert('Failed to load profile', 'error');
  }
}

function handleLogout() {
  localStorage.removeItem('jwtToken');
  document.getElementById('tab-buttons').classList.remove('hidden');
  switchTab('login');
  showAlert('Logged out successfully', 'success');
}

function resetToRegister() {
  document.getElementById('tab-buttons').classList.remove('hidden');
  switchTab('register');
}
