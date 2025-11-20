import { db } from './firebase.js';
import { requireAuth, showToast, INTEREST_LIBRARY, formatTimestamp } from './utils.js';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const page = document.body.dataset.page;
const needsAuth = ['profile', 'edit-profile'].includes(page);
let authUser = null;
let userProfile = null;

const populateProfileView = async () => {
  if (page !== 'profile') return;
  document.getElementById('profileName').textContent =
    userProfile.name ?? authUser.displayName ?? 'Student';
  document.getElementById('profileEmail').textContent = userProfile.email ?? authUser.email;
  document.getElementById('profileAvatar').src =
    userProfile.photoURL || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=300&q=80';
  const interestsHost = document.getElementById('profileInterests');
  interestsHost.innerHTML = (userProfile.interests ?? [])
    .map(
      (interest) =>
        `<span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">${interest}</span>`
    )
    .join('') || '<p class="text-xs text-slate-400">No interests added.</p>';

  const groupsSnap = await getDocs(
    query(collection(db, 'groups'), where('members', 'array-contains', authUser.uid))
  );
  document.getElementById('profileGroupsCount').textContent = groupsSnap.size;

  const postsSnap = await getDocs(
    query(collectionGroup(db, 'posts'), where('authorId', '==', authUser.uid))
  );
  document.getElementById('profilePostsCount').textContent = postsSnap.size;

  const recentGroupsHost = document.getElementById('profileRecentGroups');
  const recentGroups = groupsSnap.docs.slice(0, 3);
  recentGroupsHost.innerHTML = recentGroups.length
    ? recentGroups
        .map(
          (docSnap) => `
            <a href="group.html?id=${docSnap.id}" class="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/70 px-4 py-3">
              <div>
                <p class="text-sm font-semibold text-slate-900">${docSnap.data().name}</p>
                <p class="text-xs text-slate-400">Joined ${formatTimestamp(docSnap.data().createdAt)}</p>
              </div>
              <span class="text-xs font-semibold text-slate-500">${docSnap.data().members?.length ?? 0} members</span>
            </a>
          `
        )
        .join('')
    : '<p class="text-xs text-slate-400">Join groups to see them here.</p>';
};

const initInterestSelector = (hostId, selectedSet) => {
  const host = document.getElementById(hostId);
  if (!host) return;
  const render = () => {
    host.innerHTML = '';
    INTEREST_LIBRARY.forEach((interest) => {
      const button = document.createElement('button');
      const isActive = selectedSet.has(interest);
      button.type = 'button';
      button.textContent = interest;
      button.className = `rounded-full border px-4 py-2 text-xs font-semibold transition ${
        isActive
          ? 'border-emerald-300 bg-emerald-50 text-emerald-600'
          : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-600'
      }`;
      button.addEventListener('click', () => {
        if (isActive) {
          selectedSet.delete(interest);
        } else if (selectedSet.size < 5) {
          selectedSet.add(interest);
        } else {
          showToast('Up to five interests only', 'info');
        }
        render();
      });
      host.appendChild(button);
    });
  };
  render();
};

const populateEditProfile = () => {
  if (page !== 'edit-profile') return;
  const form = document.getElementById('editProfileForm');
  if (!form) return;
  form.name.value = userProfile.name ?? '';
  form.email.value = userProfile.email ?? authUser.email;
  form.photoURL.value = userProfile.photoURL ?? '';

  const selected = new Set(userProfile.interests ?? []);
  initInterestSelector('editInterests', selected);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const nextName = data.get('name');
    const photoURL = data.get('photoURL');
    try {
      await updateDoc(doc(db, 'users', authUser.uid), {
        name: nextName,
        photoURL,
        interests: Array.from(selected),
      });
      showToast('Profile updated!', 'success');
      window.location.href = 'profile.html';
    } catch (error) {
      console.error(error);
      showToast('Unable to update profile', 'error');
    }
  });
};

const bootstrap = async () => {
  if (!needsAuth) return;
  authUser = await requireAuth();
  const profileSnap = await getDoc(doc(db, 'users', authUser.uid));
  userProfile = { ...(profileSnap.data() ?? {}), email: authUser.email };
  await populateProfileView();
  populateEditProfile();
};

bootstrap();

