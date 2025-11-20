import { auth, db } from './firebase.js';
import { redirectAuthedUsers, requireAuth, showToast, INTEREST_LIBRARY } from './utils.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

redirectAuthedUsers();

const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const forgotModal = document.getElementById('forgotModal');
const forgotForm = document.getElementById('forgotPasswordForm');
const onboardingGrid = document.getElementById('interestGrid');

const toggleModal = (visible) => {
  if (!forgotModal) return;
  forgotModal.classList.toggle('hidden', !visible);
  if (visible) {
    forgotModal.classList.add('flex');
  } else {
    forgotModal.classList.remove('flex');
  }
};

document.getElementById('forgotPasswordTrigger')?.addEventListener('click', () => toggleModal(true));
document.getElementById('closeForgotModal')?.addEventListener('click', () => toggleModal(false));
forgotModal?.addEventListener('click', (event) => {
  if (event.target === forgotModal) toggleModal(false);
});

const handleLogin = async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const email = formData.get('email');
  const password = formData.get('password');
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const profileSnap = await getDoc(doc(db, 'users', user.uid));
    const profile = profileSnap.data();
    if (!profile?.interests?.length) {
      window.location.href = 'onboarding.html';
      return;
    }
    window.location.href = 'dashboard.html';
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Unable to sign in', 'error');
  }
};

loginForm?.addEventListener('submit', handleLogin);

const handleSignup = async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');
  if (password !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName: name });
     await setDoc(doc(db, 'users', user.uid), {
      name,
      email,
      photoURL: '',
      interests: [],
      createdAt: serverTimestamp(),
    });
    showToast('Account created! Pick your interests next.', 'success');
setTimeout(() => {
      window.location.href = 'onboarding.html';
    }, 300);
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Could not create account', 'error');
  }
};

signupForm?.addEventListener('submit', handleSignup);

forgotForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = new FormData(event.target).get('resetEmail');
  try {
    await sendPasswordResetEmail(auth, email);
    toggleModal(false);
    showToast('Reset link sent. Check your inbox.', 'success');
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Unable to send reset email', 'error');
  }
});

const initOnboarding = async () => {
  if (!onboardingGrid) return;
  const user = await requireAuth();
  const selectedInterests = new Set();
  const selectedContainer = document.getElementById('selectedInterests');
  const counter = document.getElementById('selectedCount');
  const saveBtn = document.getElementById('saveInterestsBtn');

  const profileSnap = await getDoc(doc(db, 'users', user.uid));
  const existing = profileSnap.data()?.interests ?? [];
  existing.slice(0, 5).forEach((interest) => selectedInterests.add(interest));

  const syncSelected = () => {
    counter.textContent = `${selectedInterests.size} / 5 selected`;
    saveBtn.disabled = !selectedInterests.size;
    selectedContainer.innerHTML = '';
    if (!selectedInterests.size) {
      selectedContainer.innerHTML = '<p class="text-sm text-slate-400">No interests yet...</p>';
      return;
    }
    selectedInterests.forEach((label) => {
      const tag = document.createElement('span');
      tag.className =
        'rounded-full bg-gradient-to-r from-indigo-500/10 via-fuchsia-500/10 to-emerald-400/10 px-3 py-1 text-xs font-semibold text-slate-600';
      tag.textContent = label;
      selectedContainer.appendChild(tag);
    });
  };

  const renderGrid = () => {
    onboardingGrid.innerHTML = '';
    INTEREST_LIBRARY.forEach((label) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.dataset.value = label;
      const isActive = selectedInterests.has(label);
      chip.className = `rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm transition ${
        isActive
          ? 'border-emerald-300 bg-emerald-50 text-emerald-600'
          : 'border-slate-200 bg-white/70 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
      }`;
      chip.textContent = label;
      chip.addEventListener('click', () => {
        if (selectedInterests.has(label)) {
          selectedInterests.delete(label);
        } else if (selectedInterests.size < 5) {
          selectedInterests.add(label);
        } else {
          showToast('Select up to 5 interests', 'info');
        }
        syncSelected();
        renderGrid();
      });
      onboardingGrid.appendChild(chip);
    });
  };

  saveBtn?.addEventListener('click', async () => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        interests: Array.from(selectedInterests),
      });
      showToast('Preferences saved! Taking you to the dashboard.', 'success');
      window.location.href = 'dashboard.html';
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Failed to update interests', 'error');
    }
  });

  syncSelected();
  renderGrid();
};

initOnboarding();

