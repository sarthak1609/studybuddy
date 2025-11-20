import { db } from './firebase.js';
import { requireAuth, showToast, formatTimestamp, getQueryParam } from './utils.js';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let authUser = null;
let userProfile = null;
let groupsCache = [];
let myGroupsFilter = 'all';
let myGroupsControlsBound = false;
const directoryState = {
  filters: new Set(),
  searchTerm: '',
  initialized: false,
  listHost: null,
};

const page = document.body.dataset.page;
const needsAuth = ['groups', 'group', 'create-group', 'my-groups'].includes(page);

const ensureProfile = async (user) => {
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.data();
};

const renderTags = (tags = []) =>
  tags
    .map(
      (tag) =>
        `<span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">#${tag}</span>`
    )
    .join('');

const renderEmptyState = (message) =>
  `<div class="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center text-sm text-slate-500">${message}</div>`;

const joinGroup = async (groupId) => {
  try {
    await updateDoc(doc(db, 'groups', groupId), {
      members: arrayUnion(authUser.uid),
    });
    showToast('Joined group! 🚀', 'success');
    if (page === 'group') loadGroupDetail(groupId);
    if (page === 'groups') initGroupDirectory();
    if (page === 'my-groups') initMyGroups();
  } catch (error) {
    console.error(error);
    showToast('Unable to join group', 'error');
  }
};

const leaveGroup = async (groupId) => {
  try {
    await updateDoc(doc(db, 'groups', groupId), {
      members: arrayRemove(authUser.uid),
    });
    showToast('Left the group', 'info');
    if (page === 'group') loadGroupDetail(groupId);
    if (page === 'groups') initGroupDirectory();
    if (page === 'my-groups') initMyGroups();
  } catch (error) {
    console.error(error);
    showToast('Unable to leave group', 'error');
  }
};

const groupCard = (group) => {
  const isMember = group.members?.includes(authUser.uid);
  return `
    <article class="rounded-3xl border border-white/40 bg-white/80 p-5 shadow-glass backdrop-blur-xl">
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">${group.name}</h3>
            <p class="text-sm text-slate-500">${group.description ?? ''}</p>
          </div>
          <span class="text-xs font-semibold text-slate-500">${group.members?.length ?? 0} members</span>
        </div>
        <div class="flex flex-wrap gap-2 text-xs">${renderTags(group.tags)}</div>
        <div class="flex flex-wrap gap-3 text-sm">
          <a class="rounded-2xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:border-slate-400" href="group.html?id=${group.id}">
            View group
          </a>
          <button data-group="${group.id}" data-action="${isMember ? 'leave' : 'join'}" class="rounded-2xl ${
            isMember ? 'bg-slate-100 text-slate-600' : 'bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-emerald-400 text-white'
          } px-4 py-2 font-semibold shadow-sm transition hover:scale-[1.01]">
            ${isMember ? 'Leave group' : 'Join group'}
          </button>
        </div>
      </div>
    </article>
  `;
};

const renderDirectoryList = () => {
  if (!directoryState.listHost) return;
  let filtered = groupsCache;
  if (directoryState.searchTerm) {
    filtered = filtered.filter(
      (group) =>
        group.name?.toLowerCase().includes(directoryState.searchTerm) ||
        group.description?.toLowerCase().includes(directoryState.searchTerm) ||
        group.tags?.some((tag) => tag.toLowerCase().includes(directoryState.searchTerm))
    );
  }
  if (directoryState.filters.size) {
    filtered = filtered.filter((group) =>
      group.tags?.some((tag) => directoryState.filters.has(tag.toLowerCase()))
    );
  }
  if (!filtered.length) {
    directoryState.listHost.innerHTML = renderEmptyState('No groups match your search yet.');
    return;
  }
  directoryState.listHost.innerHTML = filtered.map(groupCard).join('');
};

const setupDirectoryControls = () => {
  if (directoryState.initialized) return;
  directoryState.initialized = true;
  const searchInput = document.getElementById('groupSearchInput');
  const filterButtons = document.querySelectorAll('.filter-chip');

  filterButtons.forEach((button) => {
    button.dataset.active = button.dataset.active ?? 'false';
    button.classList.add('border', 'border-slate-200', 'bg-slate-100', 'text-slate-600');
    button.addEventListener('click', () => {
      const value = button.dataset.filter.toLowerCase();
      const isActive = directoryState.filters.has(value);
      if (isActive) {
        directoryState.filters.delete(value);
        button.classList.remove('bg-slate-900', 'text-white', 'border-slate-900');
        button.classList.add('bg-slate-100', 'text-slate-600', 'border-slate-200');
      } else {
        directoryState.filters.add(value);
        button.classList.add('bg-slate-900', 'text-white', 'border-slate-900');
        button.classList.remove('bg-slate-100', 'text-slate-600', 'border-slate-200');
      }
      renderDirectoryList();
    });
  });

  searchInput?.addEventListener('input', (event) => {
    directoryState.searchTerm = event.target.value.toLowerCase();
    renderDirectoryList();
  });

  directoryState.listHost?.addEventListener('click', (event) => {
    const actionBtn = event.target.closest('[data-action]');
    if (!actionBtn) return;
    const { group: groupId, action } = actionBtn.dataset;
    if (action === 'join') joinGroup(groupId);
    else leaveGroup(groupId);
  });
};

const initGroupDirectory = async () => {
  const listHost = document.getElementById('groupResults');
  if (!listHost) return;
  directoryState.listHost = listHost;
  const snapshot = await getDocs(query(collection(db, 'groups'), orderBy('createdAt', 'desc'), limit(40)));
  groupsCache = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  renderDirectoryList();
  setupDirectoryControls();
};

const initCreateGroup = () => {
  const form = document.getElementById('createGroupForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = data.get('name');
    const description = data.get('description');
    const tags = data
      .get('tags')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    try {
      const docRef = await addDoc(collection(db, 'groups'), {
        name,
        description,
        tags,
        members: [authUser.uid],
        ownerId: authUser.uid,
        createdAt: serverTimestamp(),
      });
      showToast('Group created!', 'success');
      window.location.href = `group.html?id=${docRef.id}`;
    } catch (error) {
      console.error(error);
      showToast('Unable to create group', 'error');
    }
  });
};

const initMyGroups = async () => {
  const host = document.getElementById('myGroupsList');
  if (!host) return;
  const snapshot = await getDocs(
    query(collection(db, 'groups'), where('members', 'array-contains', authUser.uid))
  );
  const groups = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  document.getElementById('myGroupsCount').textContent = groups.length;
  const filterButtons = document.querySelectorAll('[data-my-groups-filter]');

  const renderList = () => {
    const filtered = groups
      .filter((group) => {
        if (myGroupsFilter === 'owner') return group.ownerId === authUser.uid;
        if (myGroupsFilter === 'member') return group.ownerId !== authUser.uid;
      return true;
      })
      .sort(
        (a, b) =>
          (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
      );
    if (!filtered.length) {
      host.innerHTML = renderEmptyState('No groups match this filter.');
      return;
    }
    host.innerHTML = filtered
      .map(
        (group) => `
      <article class="rounded-3xl border border-white/40 bg-white/80 p-5 shadow-glass backdrop-blur-xl">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">${group.name}</h3>
            <p class="text-sm text-slate-500">${group.ownerId === authUser.uid ? 'You created this group' : 'Member since'} ${formatTimestamp(group.createdAt)}</p>
            <div class="mt-3 flex flex-wrap gap-2 text-xs">${renderTags(group.tags)}</div>
          </div>
          <div class="flex flex-col gap-3 text-sm">
            <a href="group.html?id=${group.id}" class="rounded-2xl bg-slate-900 px-4 py-2 text-center font-semibold text-white">Open</a>
            <button data-group="${group.id}" class="rounded-2xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:border-slate-400">Leave</button>
          </div>
        </div>
      </article>
    `
      )
      .join('');

    host.querySelectorAll('button[data-group]').forEach((button) => {
      button.addEventListener('click', () => leaveGroup(button.dataset.group));
    });
  };

  if (!myGroupsControlsBound) {
    myGroupsControlsBound = true;
    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        myGroupsFilter = button.dataset.myGroupsFilter;
        filterButtons.forEach((btn) => {
          const isActive = btn === button;
          btn.classList.toggle('bg-slate-900', isActive);
          btn.classList.toggle('text-white', isActive);
          btn.classList.toggle('text-slate-600', !isActive);
          btn.classList.toggle('bg-slate-100', !isActive);
        });
        renderList();
      });
    });
  }

  filterButtons.forEach((button) => {
    const isActive = button.dataset.myGroupsFilter === myGroupsFilter;
    button.classList.toggle('bg-slate-900', isActive);
    button.classList.toggle('text-white', isActive);
    button.classList.toggle('text-slate-600', !isActive);
    button.classList.toggle('bg-slate-100', !isActive);
  });

  renderList();
};

const renderPost = (groupId, post) => `
  <article class="rounded-3xl border border-slate-100 bg-white/80 p-5 shadow-inner shadow-white/40">
    <div class="flex flex-col gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400">${formatTimestamp(post.createdAt)}</p>
        <h3 class="text-lg font-semibold text-slate-900">${post.title}</h3>
        <p class="text-sm text-slate-500 line-clamp-3">${post.content}</p>
      </div>
      <p class="text-xs text-slate-500">by ${post.authorName ?? 'Anonymous'}</p>
      <div id="comments-${post.id}" class="space-y-3 text-sm text-slate-600"></div>
      <form data-comment-form="${post.id}" class="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 flex gap-3">
        <input type="text" name="comment" required placeholder="Drop a quick reply..." class="flex-1 bg-transparent text-sm focus:outline-none" />
        <button class="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Send</button>
      </form>
    </div>
  </article>
`;

const loadComments = async (groupId, postId) => {
  const commentsHost = document.getElementById(`comments-${postId}`);
  if (!commentsHost) return;
  const snapshot = await getDocs(
    query(collection(db, 'groups', groupId, 'posts', postId, 'comments'), orderBy('createdAt', 'desc'), limit(3))
  );
  if (!snapshot.empty) {
    commentsHost.innerHTML = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data();
        return `<div class="rounded-2xl border border-slate-100 bg-white/70 px-3 py-2"><p class="text-sm text-slate-700">${data.message}</p><p class="text-xs text-slate-400 mt-1">— ${data.authorName ?? 'Anonymous'}, ${formatTimestamp(
          data.createdAt
        )}</p></div>`;
      })
      .join('');
  } else {
    commentsHost.innerHTML = '<p class="text-xs text-slate-400">No comments yet.</p>';
  }
};

const loadRecentComments = async (groupId, postsSnapshot) => {
  const recentHost = document.getElementById('recentComments');
  if (!recentHost) return;
  const commentPromises = postsSnapshot.docs.map(async (docSnap) => {
    const commentsSnap = await getDocs(
      query(collection(db, 'groups', groupId, 'posts', docSnap.id, 'comments'), orderBy('createdAt', 'desc'), limit(1))
    );
    return commentsSnap.docs.map((cSnap) => ({
      id: cSnap.id,
      ...cSnap.data(),
      postTitle: docSnap.data().title,
    }));
  });
  const comments = (await Promise.all(commentPromises)).flat().sort(
    (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
  );
  recentHost.innerHTML = comments.length
    ? comments
        .slice(0, 5)
        .map(
          (comment) => `
      <div class="rounded-2xl border border-slate-100 bg-white/70 p-4">
        <p class="text-sm font-semibold text-slate-900">${comment.authorName ?? 'Anonymous'} <span class="text-xs text-slate-400">on ${comment.postTitle}</span></p>
        <p class="mt-1 text-sm text-slate-600 line-clamp-2">${comment.message}</p>
        <p class="mt-2 text-[11px] text-slate-400">${formatTimestamp(comment.createdAt)}</p>
      </div>
    `
        )
        .join('')
    : '<p class="text-sm text-slate-400">No replies yet.</p>';
};

const loadGroupDetail = async (groupId) => {
  const headerName = document.getElementById('groupName');
  if (!headerName) return;
  const snap = await getDoc(doc(db, 'groups', groupId));
  if (!snap.exists()) {
    headerName.textContent = 'Group not found';
    showToast('Group not found', 'error');
    return;
  }
  const data = snap.data();
  headerName.textContent = data.name;
  document.getElementById('groupDescription').textContent = data.description ?? '';
  document.getElementById('groupTags').innerHTML = renderTags(data.tags);
  document.getElementById('memberCount').textContent = data.members?.length ?? 0;
  document.getElementById('createdDate').textContent = formatTimestamp(data.createdAt);

  const isMember = data.members?.includes(authUser.uid);
  document.getElementById('joinGroupButton').classList.toggle('hidden', isMember);
  document.getElementById('leaveGroupButton').classList.toggle('hidden', !isMember);

  document.getElementById('joinGroupButton').onclick = () => joinGroup(groupId);
  document.getElementById('leaveGroupButton').onclick = () => leaveGroup(groupId);
  const createPostForm = document.getElementById('createPostForm');
  if (createPostForm) {
    createPostForm.querySelectorAll('input, textarea, button').forEach((element) => {
      element.disabled = !isMember;
      element.classList.toggle('opacity-50', !isMember);
    });
    createPostForm.dataset.memberOnly = isMember ? 'true' : 'false';
  }

  const postsHost = document.getElementById('groupPosts');
  const postsSnapshot = await getDocs(
    query(collection(db, 'groups', groupId, 'posts'), orderBy('createdAt', 'desc'), limit(20))
  );
  if (postsSnapshot.empty) {
    postsHost.innerHTML = renderEmptyState('No posts yet. Start the conversation!');
    const recentHost = document.getElementById('recentComments');
    if (recentHost) {
      recentHost.innerHTML = '<p class="text-sm text-slate-400">No replies yet.</p>';
    }
  } else {
    postsHost.innerHTML = postsSnapshot.docs
      .map((docSnap) => renderPost(groupId, { id: docSnap.id, ...docSnap.data() }))
      .join('');
    postsSnapshot.docs.forEach((docSnap) => loadComments(groupId, docSnap.id));
    loadRecentComments(groupId, postsSnapshot);
  }
};

const initGroupDetailPage = () => {
  const groupId = getQueryParam('id');
  if (!groupId) {
    showToast('Missing group id', 'error');
    return;
  }
  const createPostForm = document.getElementById('createPostForm');
  createPostForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (createPostForm.dataset.memberOnly === 'false') {
      showToast('Join the group to post updates', 'info');
      return;
    }
    const data = new FormData(createPostForm);
    const title = data.get('title');
    const content = data.get('content');
    try {
      await addDoc(collection(db, 'groups', groupId, 'posts'), {
        title,
        content,
        authorId: authUser.uid,
        authorName: userProfile?.name ?? authUser.displayName ?? 'Anonymous',
        createdAt: serverTimestamp(),
      });
      createPostForm.reset();
      showToast('Post published', 'success');
      loadGroupDetail(groupId);
    } catch (error) {
      console.error(error);
      showToast('Unable to publish post', 'error');
    }
  });

  document.getElementById('groupPosts')?.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-comment-form]');
    if (!form) return;
    event.preventDefault();
    const postId = form.dataset.commentForm;
    const content = new FormData(form).get('comment');
    try {
      await addDoc(collection(db, 'groups', groupId, 'posts', postId, 'comments'), {
        message: content,
        authorId: authUser.uid,
        authorName: userProfile?.name ?? authUser.displayName ?? 'Anonymous',
        createdAt: serverTimestamp(),
      });
      form.reset();
      loadComments(groupId, postId);
    } catch (error) {
      console.error(error);
      showToast('Unable to add comment', 'error');
    }
  });

  loadGroupDetail(groupId);
};

const bootstrap = async () => {
  if (!needsAuth) return;
  authUser = await requireAuth();
  userProfile = await ensureProfile(authUser);

  switch (page) {
    case 'groups':
      initGroupDirectory();
      break;
    case 'create-group':
      initCreateGroup();
      break;
    case 'my-groups':
      initMyGroups();
      break;
    case 'group':
      initGroupDetailPage();
      break;
    default:
      break;
  }
};

bootstrap();

