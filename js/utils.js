import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

export const INTEREST_LIBRARY = [
  'Web Dev',
  'App Dev',
  'AI/ML',
  'Robotics',
  'Electronics',
  'Mechanical',
  'Finance',
  'Photography',
  'Video Editing',
  'Design',
  'Coding',
  'Cybersecurity',
  'Game Dev',
  'Blockchain',
  'Product Strategy',
  'Marketing',
  'Content Creation',
  'Data Science',
  'Hardware',
  'Community Building',
];

// const NAV_ICONS = {
//   dashboard:
//     '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h7.5m-7.5 5.25h16.5"/></svg>',
//   'my-groups':
//     '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a3 3 0 110 6 3 3 0 010-6zM4.5 19.5a7.5 7.5 0 0115 0M16.5 6.75h4.125M3.375 6.75H7.5m-4.125 3.75H7.5m9 0h4.125"/></svg>',
//   groups:
//     '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 13.5a3 3 0 10-6 0 3 3 0 006 0zm-9 0a3 3 0 11-4.5-2.598M21 13.5a3 3 0 11-4.5-2.598M3 19.5v-.75A4.5 4.5 0 017.5 14.25h.75m12.75 5.25v-.75a4.5 4.5 0 00-4.5-4.5h-.75"/></svg>',
//   'create-group':
//     '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>',
//   profile:
//     '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0"/></svg>',
//   'edit-profile':
//     '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.75 19.875 3 21l1.125-3.75L16.862 4.487z"/></svg>',
//   default:
//     '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 6h15M4.5 12h15m-15 6h15"/></svg>',
// };

/**
 * Protect private pages and redirect if no authenticated user exists.
 */
export const requireAuth = (onAuthenticated, { redirectTo = 'index.html' } = {}) =>
  new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = redirectTo;
        return;
      }
      unsubscribe();
      onAuthenticated?.(user);
      resolve(user);
    });
  });

/**
 * Send logged-in users away from auth-only pages.
 */
export const redirectAuthedUsers = () => {
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    const publicPages = ['index.html', ''];
    const current = window.location.pathname.split('/').pop() || 'index.html';
    if (publicPages.includes(current)) {
      window.location.href = 'dashboard.html';
    }
  });
};

export const showToast = (message, variant = 'success') => {
  let container = document.getElementById('toastHost');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastHost';
    container.className = 'fixed bottom-6 right-6 z-50 flex flex-col gap-3';
    document.body.appendChild(container);
  }
  const colors = {
    success: 'from-emerald-400 via-teal-400 to-cyan-400',
    error: 'from-rose-500 via-fuchsia-500 to-orange-400',
    info: 'from-indigo-500 via-blue-500 to-cyan-500',
  };
  const toast = document.createElement('div');
  toast.className = `min-w-[220px] rounded-2xl bg-gradient-to-r ${colors[variant] ?? colors.info} px-4 py-3 text-sm font-semibold text-white shadow-2xl shadow-slate-900/30`;
  toast.style.transition = 'all 320ms cubic-bezier(0.4, 0, 0.2, 1)';
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(12px)';
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3200);
};

export const formatTimestamp = (ts) => {
  if (!ts) return 'Moments ago';
  const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export const getQueryParam = (key) =>
  new URLSearchParams(window.location.search).get(key);

const highlightNavigation = () => {
  const activePage = document.body.dataset.page;
  if (!activePage) return;
  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.iconApplied !== 'true') {
      const iconWrapper = document.createElement('span');
      iconWrapper.className = 'h-5 w-5 text-slate-400';
      iconWrapper.innerHTML = NAV_ICONS[link.dataset.nav] ?? NAV_ICONS.default;
      const firstSpan = link.querySelector('span');
      firstSpan?.classList.add('hidden');
      link.insertBefore(iconWrapper, link.firstChild);
      link.dataset.iconApplied = 'true';
    }
    const isActive = link.dataset.nav === activePage;
    link.classList.toggle('bg-white', isActive);
    link.classList.toggle('text-slate-900', isActive);
    link.classList.toggle('border', isActive);
    if (isActive) {
      link.classList.add('shadow-inner', 'border-white/40');
    } else {
      link.classList.remove('shadow-inner', 'border-white/40');
    }
  });
};

const attachSignOutButtons = () => {
  const signOutButtons = [
    document.getElementById('signOutButton'),
    document.getElementById('signOutButtonMobile'),
  ].filter(Boolean);

  signOutButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      await signOut(auth);
      window.location.href = 'index.html';
    });
  });
};

document.addEventListener('DOMContentLoaded', () => {
  highlightNavigation();
  attachSignOutButtons();
});
window.logout = async function () {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Sign-out error:", error);
    alert("Failed to sign out");
  }
};

