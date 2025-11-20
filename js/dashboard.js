import { db } from './firebase.js';
import { requireAuth, formatTimestamp, showToast } from './utils.js';

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let authUser = null;
let userProfile = null;

const recommendedHost = document.getElementById('recommendedGroups');
const trendingHost = document.getElementById('trendingGroups');
const postsHost = document.getElementById('recentPosts');
const yourGroupsHost = document.getElementById('yourGroups');

const miniGroupCard = (group) => `
  <article class="rounded-3xl border border-white/40 bg-white/80 p-4 shadow-inner shadow-white/40 backdrop-blur-xl">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-slate-900">${group.name}</h3>
        <p class="text-xs text-slate-500">${group.description ?? ''}</p>
      </div>
      <span class="text-[11px] font-semibold text-slate-400">${group.members?.length ?? 0} in squad</span>
    </div>
    <div class="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
      ${(group.tags || [])
        .slice(0, 3)
        .map((tag) => `<span class="rounded-full bg-slate-100 px-2 py-1">#${tag}</span>`)
        .join('')}
    </div>
    <div class="mt-4 flex gap-3">
      <a href="group.html?id=${group.id}" class="text-xs font-semibold text-indigo-600 hover:text-indigo-500">Open</a>
      <a href="groups.html" class="text-xs font-semibold text-slate-500">More</a>
    </div>
  </article>
`;

const postCard = (post) => `
  <article class="rounded-3xl border border-white/40 bg-white/80 p-4 shadow-inner shadow-white/40">
    <p class="text-xs uppercase tracking-[0.35em] text-slate-400">${formatTimestamp(post.createdAt)}</p>
    <h3 class="mt-2 text-lg font-semibold text-slate-900">${post.title}</h3>
    <p class="text-sm text-slate-500 line-clamp-2">${post.content}</p>
    <div class="mt-3 flex justify-between text-xs text-slate-500">
      <span>by ${post.authorName ?? 'Anonymous'}</span>
      <a href="group.html?id=${post.groupId}" class="font-semibold text-indigo-600">Open group</a>
    </div>
  </article>
`;

const loadProfile = async () => {
  const user = await requireAuth();
  authUser = user;
  const profileSnap = await getDoc(doc(db, 'users', user.uid));
  userProfile = { ...(profileSnap.data() ?? {}), id: profileSnap.id };
  document.getElementById('dashboardUserName').textContent =
    userProfile.name ?? user.displayName ?? 'Friend';
  return userProfile;
};

const loadRecommendedGroups = async () => {
  if (!recommendedHost) return;
  let q = query(collection(db, 'groups'), orderBy('createdAt', 'desc'), limit(6));
  if (userProfile?.interests?.length) {
    q = query(
      collection(db, 'groups'),
      where('tags', 'array-contains-any', userProfile.interests.slice(0, 10)),
      limit(6)
    );
  }
  const snapshot = await getDocs(q);
  const groups = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  document.getElementById('recommendedCount').textContent = groups.length;
  recommendedHost.innerHTML = groups.length
    ? groups.map(miniGroupCard).join('')
    : '<p class="text-sm text-slate-500">No recommendations yet. Add interests in your profile!</p>';
};

const loadTrendingGroups = async () => {
  if (!trendingHost) return;
  const snapshot = await getDocs(query(collection(db, 'groups'), limit(12)));
  const groups = snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .sort((a, b) => (b.members?.length ?? 0) - (a.members?.length ?? 0))
    .slice(0, 6);
  document.getElementById('trendingCount').textContent = groups.length;
  trendingHost.innerHTML = groups.length
    ? groups.map(miniGroupCard).join('')
    : '<p class="text-sm text-slate-500">Create the very first trending group!</p>';
};

const loadRecentPosts = async () => {
  if (!postsHost) return;
  const snapshot = await getDocs(
    query(collectionGroup(db, 'posts'), orderBy('createdAt', 'desc'), limit(6))
  );
  const posts = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      groupId: docSnap.ref.parent.parent.id,
    };
  });
  postsHost.innerHTML = posts.length
    ? posts.map(postCard).join('')
    : '<p class="text-sm text-slate-500">No posts yet. Start the conversation!</p>';
};

const loadYourGroups = async () => {
  if (!yourGroupsHost) return;
  const snapshot = await getDocs(
    query(collection(db, 'groups'), where('members', 'array-contains', authUser.uid), limit(6))
  );
  const groups = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  yourGroupsHost.innerHTML = groups.length
    ? groups
        .map(
          (group) => `
        <div class="rounded-2xl border border-slate-100 bg-white/70 p-3 text-sm text-slate-600 flex items-center justify-between">
          <div>
            <p class="font-semibold text-slate-900">${group.name}</p>
            <p class="text-xs text-slate-400">${group.members?.length ?? 0} members</p>
          </div>
          <a href="group.html?id=${group.id}" class="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Open</a>
        </div>
      `
        )
        .join('')
    : '<p class="text-sm text-slate-500">You have no groups yet. Join one today.</p>';
};



const bootstrap = async () => {
  try {
    await loadProfile();
    await Promise.all([
      loadRecommendedGroups(),
      loadTrendingGroups(),
      loadRecentPosts(),
      loadYourGroups(),
    ]);
  } catch (error) {
    console.error(error);
    showToast('Unable to load dashboard data', 'error');
  }
};

bootstrap();

