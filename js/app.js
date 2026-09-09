import { firebaseConfig } from './firebase-config.js';

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, onAuthStateChanged, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

if (typeof gsap !== 'undefined' && typeof Flip !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
  gsap.registerPlugin(Flip, ScrollTrigger);
}

let currentUser = null;
let allBooks = [];
let allWishlist = [];
let sharesList = [];       // библиотеки, которыми я поделился(-ась) с другими
let sharedWithMeList = []; // библиотеки, к которым имею доступ я

let unsubscribeItems = null;
let unsubscribeShares = null;
let unsubscribeSharedWithMe = null;
let unsubscribeWishlist = null;

const bookCardEls = new Map(); // id -> постоянный DOM-узел карточки (нужно для GSAP Flip)
let gridScrollCtx = null;      // gsap.context() для ScrollTrigger-реакций сетки книг
let hasAnimatedPageEntrance = false;

// currentView: {type:'mine'} | {type:'wishlist'} | {type:'shared', ownerUid, ownerEmail}
let currentView = { type: 'mine' };
let viewMode = localStorage.getItem('viewMode') || 'grid'; // 'grid' | 'list'
let selectMode = false;
let selectedIds = new Set();

const GENRE_COLORS = ['--accent', '--info', '--success', '--warning', '--danger'];

// ---------- Тема (светлая / тёмная) ----------
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

(function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) {
    applyTheme(saved);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  if (typeof gsap !== 'undefined' && !prefersReducedMotion()) {
    gsap.timeline()
      .to(document.body, { opacity: 0.6, duration: 0.12, ease: 'power1.in', overwrite: 'auto' })
      .call(() => applyTheme(next))
      .to(document.body, { opacity: 1, duration: 0.18, ease: 'power1.out' });
  } else {
    applyTheme(next);
  }
}

document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
document.getElementById('theme-toggle-login').addEventListener('click', toggleTheme);

// ---------- Элементы DOM ----------
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const registerForm = document.getElementById('register-form');
const registerError = document.getElementById('register-error');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const userEmailEl = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');

const librarySwitcher = document.getElementById('library-switcher');
const bookGrid = document.getElementById('book-grid');
const emptyState = document.getElementById('empty-state');
const emptyStateText = document.getElementById('empty-state-text');
const emptyAddBtn = document.getElementById('empty-add-btn');
const greetingTitle = document.getElementById('greeting-title');
const greetingSubtitle = document.getElementById('greeting-subtitle');
const greetingBlock = document.getElementById('greeting-block');
const editNameBtn = document.getElementById('edit-name-btn');
const nameModal = document.getElementById('name-modal');
const nameForm = document.getElementById('name-form');
const displayNameInput = document.getElementById('display-name-input');
const nameCancelBtn = document.getElementById('name-cancel-btn');
const readingShelf = document.getElementById('reading-shelf');
const readingShelfRow = document.getElementById('reading-shelf-row');
const searchInput = document.getElementById('search-input');
const genreFilter = document.getElementById('genre-filter');
const statusFilter = document.getElementById('status-filter');
const readStatusFilter = document.getElementById('read-status-filter');
const sortSelect = document.getElementById('sort-select');
const addBookBtn = document.getElementById('add-book-btn');
const gridViewBtn = document.getElementById('grid-view-btn');
const listViewBtn = document.getElementById('list-view-btn');
const selectModeBtn = document.getElementById('select-mode-btn');

const bulkBar = document.getElementById('bulk-bar');
const bulkCount = document.getElementById('bulk-count');
const bulkLendBtn = document.getElementById('bulk-lend-btn');
const bulkCancelBtn = document.getElementById('bulk-cancel-btn');

const statTotal = document.getElementById('stat-total');
const statLent = document.getElementById('stat-lent');
const statAvailable = document.getElementById('stat-available');
const statOverdue = document.getElementById('stat-overdue');

const bookModal = document.getElementById('book-modal');
const bookForm = document.getElementById('book-form');
const bookModalTitle = document.getElementById('book-modal-title');
const bookIdInput = document.getElementById('book-id');
const bookIsbnInput = document.getElementById('book-isbn');
const isbnLookupBtn = document.getElementById('isbn-lookup-btn');
const isbnStatus = document.getElementById('isbn-status');
const coverPreview = document.getElementById('cover-preview');
const coverUploadInput = document.getElementById('cover-upload-input');
const bookCoverInput = document.getElementById('book-cover');
const bookTitleInput = document.getElementById('book-title');
const bookAuthorInput = document.getElementById('book-author');
const bookGenreInput = document.getElementById('book-genre');
const bookShelfInput = document.getElementById('book-shelf');
const bookPublisherInput = document.getElementById('book-publisher');
const bookYearInput = document.getElementById('book-year');
const bookPagesInput = document.getElementById('book-pages');
const bookReadStatusInput = document.getElementById('book-read-status');
const bookNotesInput = document.getElementById('book-notes');
const bookRatingInput = document.getElementById('book-rating');
const starPicker = document.getElementById('star-picker');
const genreList = document.getElementById('genre-list');
const bookCancelBtn = document.getElementById('book-cancel-btn');

const quoteInput = document.getElementById('quote-input');
const quoteAddBtn = document.getElementById('quote-add-btn');
const quotesListEl = document.getElementById('quotes-list');
let quotesDraft = [];

const lendModal = document.getElementById('lend-modal');
const lendModalTitle = document.getElementById('lend-modal-title');
const lendForm = document.getElementById('lend-form');
const lendBookIdInput = document.getElementById('lend-book-id');
const lendBorrowerInput = document.getElementById('lend-borrower');
const lendDateInput = document.getElementById('lend-date');
const lendDueDateInput = document.getElementById('lend-due-date');
const lendCancelBtn = document.getElementById('lend-cancel-btn');

const statsBtn = document.getElementById('stats-btn');
const statsModal = document.getElementById('stats-modal');
const statsChart = document.getElementById('stats-chart');
const statsCloseBtn = document.getElementById('stats-close-btn');

const viewModal = document.getElementById('view-modal');
const viewCover = document.getElementById('view-cover');
const viewTitle = document.getElementById('view-title');
const viewAuthor = document.getElementById('view-author');
const viewMeta = document.getElementById('view-meta');
const viewStars = document.getElementById('view-stars');
const viewBadges = document.getElementById('view-badges');
const viewLendInfo = document.getElementById('view-lend-info');
const viewNotesSection = document.getElementById('view-notes-section');
const viewNotes = document.getElementById('view-notes');
const viewQuotesSection = document.getElementById('view-quotes-section');
const viewQuotesList = document.getElementById('view-quotes-list');
const viewCloseBtn = document.getElementById('view-close-btn');
const viewEditBtn = document.getElementById('view-edit-btn');
let viewedBook = null;

const exportCsvBtn = document.getElementById('export-csv-btn');

const shareBtn = document.getElementById('share-btn');
const shareModal = document.getElementById('share-modal');
const shareEmailInput = document.getElementById('share-email-input');
const shareSubmitBtn = document.getElementById('share-submit-btn');
const shareStatus = document.getElementById('share-status');
const sharesListEl = document.getElementById('shares-list');
const shareCloseBtn = document.getElementById('share-close-btn');

const wishlistModal = document.getElementById('wishlist-modal');
const wishlistModalTitle = document.getElementById('wishlist-modal-title');
const wishlistForm = document.getElementById('wishlist-form');
const wishlistIdInput = document.getElementById('wishlist-id');
const wishlistTitleInput = document.getElementById('wishlist-title');
const wishlistAuthorInput = document.getElementById('wishlist-author');
const wishlistCoverInput = document.getElementById('wishlist-cover');
const wishlistCancelBtn = document.getElementById('wishlist-cancel-btn');

const toast = document.getElementById('toast');

// ---------- Вспомогательные функции ----------
function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2500);
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function booksCollectionRef(ownerUid) {
  return collection(db, 'users', ownerUid, 'books');
}

function wishlistCollectionRef() {
  return collection(db, 'users', currentUser.uid, 'wishlist');
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('ru-RU');
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(book) {
  return book.status === 'lent' && book.dueDate && book.dueDate < todayIso();
}

function addedAtMillis(item) {
  if (!item.addedAt) return 0;
  if (typeof item.addedAt.toMillis === 'function') return item.addedAt.toMillis();
  if (item.addedAt.seconds) return item.addedAt.seconds * 1000;
  return 0;
}

function toHttps(url) {
  return url ? url.replace(/^http:\/\//i, 'https://') : url;
}

const READ_STATUS_LABELS = { want: 'Хочу прочитать', reading: 'Читаю', done: 'Прочитано' };
const READ_STATUS_CLASS = { want: 'badge-want', reading: 'badge-reading', done: 'badge-done' };

const COVER_PLACEHOLDER_SVG = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M4 4.5C4 3.67 4.67 3 5.5 3H12V21H5.5C4.67 21 4 20.33 4 19.5V4.5Z" fill="currentColor" opacity="0.35"/><path d="M12 3H18.5C19.33 3 20 3.67 20 4.5V19.5C20 20.33 19.33 21 18.5 21H12V3Z" fill="currentColor" opacity="0.55"/></svg>`;
const QUOTE_ICON_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M7 8C5 8 4 9.5 4 11.5C4 13.5 5.3 15 7.2 15C7.2 17 6 18.5 4 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 8C14 8 13 9.5 13 11.5C13 13.5 14.3 15 16.2 15C16.2 17 15 18.5 13 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function coverHtml(coverUrl) {
  const hasCover = Boolean(coverUrl);
  const safeUrl = escapeHtml(coverUrl || '');
  return `
    <img src="${safeUrl}" alt="" style="${hasCover ? '' : 'display:none'}"
         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
    <div class="cover-placeholder" style="display:${hasCover ? 'none' : 'flex'}">${COVER_PLACEHOLDER_SVG}</div>`;
}

function bookMetaHtml(b) {
  const parts = [];
  if (b.publisher) parts.push(escapeHtml(b.publisher));
  if (b.year) parts.push(escapeHtml(String(b.year)));
  if (b.pages) parts.push(`${escapeHtml(String(b.pages))} стр.`);
  return parts.length ? `<p class="book-meta">${parts.join(' · ')}</p>` : '';
}

// ---------- Переключение вкладок Вход / Регистрация ----------
tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  loginError.textContent = '';
  registerError.textContent = '';
});

tabRegister.addEventListener('click', () => {
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  loginError.textContent = '';
  registerError.textContent = '';
});

// ---------- Авторизация ----------
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = 'Не удалось войти: проверьте email и пароль.';
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  registerError.textContent = '';
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const passwordConfirm = document.getElementById('register-password-confirm').value;

  if (password.length < 6) {
    registerError.textContent = 'Пароль должен быть не короче 6 символов.';
    return;
  }
  if (password !== passwordConfirm) {
    registerError.textContent = 'Пароли не совпадают.';
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      registerError.textContent = 'Этот email уже зарегистрирован. Попробуйте войти.';
    } else if (err.code === 'auth/invalid-email') {
      registerError.textContent = 'Некорректный email.';
    } else {
      registerError.textContent = 'Не удалось создать аккаунт. Попробуйте ещё раз.';
    }
  }
});

forgotPasswordLink.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  if (!email) {
    loginError.textContent = 'Введите email в поле выше, затем нажмите «Забыли пароль?».';
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    loginError.textContent = '';
    showToast('Письмо для сброса пароля отправлено на ' + email);
  } catch (err) {
    loginError.textContent = 'Не удалось отправить письмо. Проверьте email.';
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    userEmailEl.textContent = user.email;
    ensureEmailMapping(user);
    currentView = { type: 'mine' };
    librarySwitcher.value = 'mine';
    subscribeShares();
    subscribeSharedWithMe();
    subscribeWishlist();
    subscribeCurrentView();
  } else {
    appScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    tabLogin.click();
    loginForm.reset();
    registerForm.reset();
    loginError.textContent = '';
    registerError.textContent = '';
    if (unsubscribeItems) unsubscribeItems();
    if (unsubscribeShares) unsubscribeShares();
    if (unsubscribeSharedWithMe) unsubscribeSharedWithMe();
    if (unsubscribeWishlist) unsubscribeWishlist();
    if (gridScrollCtx) { gridScrollCtx.revert(); gridScrollCtx = null; }
    if (typeof gsap !== 'undefined') gsap.killTweensOf(bookGrid.querySelectorAll('.book-card'));
    bookCardEls.clear();
    bookGrid.innerHTML = '';
    hasAnimatedPageEntrance = false;
    allBooks = [];
    allWishlist = [];
    sharesList = [];
    sharedWithMeList = [];
  }
});

// ---------- Постоянная подписка на желания (нужна и для раздела «Желания»,
// и для отображения лайков в чужих библиотеках) ----------
function subscribeWishlist() {
  if (unsubscribeWishlist) unsubscribeWishlist();
  const q = query(wishlistCollectionRef(), orderBy('addedAt', 'desc'));
  unsubscribeWishlist = onSnapshot(q, (snapshot) => {
    allWishlist = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (currentView.type === 'wishlist' || currentView.type === 'shared') {
      renderCurrentView();
    }
  }, (err) => console.warn(err));
}

async function ensureEmailMapping(user) {
  try {
    await setDoc(doc(db, 'usersByEmail', normalizeEmail(user.email)), { uid: user.uid }, { merge: true });
  } catch (err) {
    console.warn('Не удалось обновить usersByEmail:', err);
  }
}

// ---------- Подписка на текущий раздел (моя библиотека / желания / чужая библиотека) ----------
function skeletonGridHtml(n) {
  let html = '';
  for (let i = 0; i < n; i++) {
    html += `<div class="skeleton-card">
      <div class="skeleton-block skeleton-cover"></div>
      <div class="skeleton-block skeleton-line"></div>
      <div class="skeleton-block skeleton-line short"></div>
    </div>`;
  }
  return html;
}

function subscribeCurrentView() {
  if (unsubscribeItems) unsubscribeItems();
  selectMode = false;
  selectedIds.clear();
  updateBulkBar();
  updateToolbarForView();
  emptyState.classList.add('hidden');
  bookGrid.classList.remove('view-list');
  if (gridScrollCtx) { gridScrollCtx.revert(); gridScrollCtx = null; }
  bookCardEls.clear();
  bookGrid.innerHTML = skeletonGridHtml(6);

  if (currentView.type === 'wishlist') {
    renderCurrentView();
  } else {
    const ownerUid = currentView.type === 'shared' ? currentView.ownerUid : currentUser.uid;
    const q = query(booksCollectionRef(ownerUid), orderBy('addedAt', 'desc'));
    unsubscribeItems = onSnapshot(q, (snapshot) => {
      allBooks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      updateGenreFilterOptions();
      renderCurrentView();
    }, (error) => {
      console.error(error);
      showToast(currentView.type === 'shared' ? 'Нет доступа к этой библиотеке' : 'Ошибка загрузки данных из Firestore');
    });
  }
}

function updateToolbarForView() {
  const isWishlist = currentView.type === 'wishlist';
  const isShared = currentView.type === 'shared';
  const isMine = currentView.type === 'mine';

  document.getElementById('stats-row').classList.toggle('hidden', !isMine);
  greetingBlock.classList.toggle('hidden', !isMine);
  if (!isMine) readingShelf.classList.add('hidden');
  genreFilter.classList.toggle('hidden', isWishlist);
  statusFilter.classList.toggle('hidden', isWishlist);
  readStatusFilter.classList.toggle('hidden', isWishlist);
  selectModeBtn.classList.toggle('hidden', !isMine);
  shareBtn.classList.toggle('hidden', !isMine);

  addBookBtn.textContent = isWishlist ? '+ Добавить в желания' : '+ Добавить книгу';
  addBookBtn.classList.toggle('hidden', isShared);

  emptyStateText.textContent = isWishlist
    ? 'В списке желаний пока пусто.'
    : (isShared ? 'В этой библиотеке пока нет книг.' : 'Пока в вашей библиотеке нет книг.');
}

librarySwitcher.addEventListener('change', () => {
  const value = librarySwitcher.value;
  if (value === 'mine') {
    currentView = { type: 'mine' };
  } else if (value === 'wishlist') {
    currentView = { type: 'wishlist' };
  } else if (value.startsWith('shared:')) {
    const ownerUid = value.slice('shared:'.length);
    const entry = sharedWithMeList.find(s => s.ownerUid === ownerUid);
    currentView = { type: 'shared', ownerUid, ownerEmail: entry?.ownerEmail || '' };
  }
  subscribeCurrentView();
});

// ---------- Общий доступ: список тех, кому я открыл(а) доступ ----------
function subscribeShares() {
  if (unsubscribeShares) unsubscribeShares();
  const q = collection(db, 'users', currentUser.uid, 'shares');
  unsubscribeShares = onSnapshot(q, (snapshot) => {
    sharesList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSharesList();
  }, (err) => console.warn(err));
}

// ---------- Общий доступ: библиотеки, доступные мне ----------
function subscribeSharedWithMe() {
  if (unsubscribeSharedWithMe) unsubscribeSharedWithMe();
  const q = collection(db, 'users', currentUser.uid, 'sharedWithMe');
  unsubscribeSharedWithMe = onSnapshot(q, (snapshot) => {
    sharedWithMeList = snapshot.docs.map(d => ({ ownerUid: d.id, ...d.data() }));
    updateLibrarySwitcherOptions();
  }, (err) => console.warn(err));
}

function updateLibrarySwitcherOptions() {
  const currentValue = librarySwitcher.value;
  [...librarySwitcher.querySelectorAll('option[data-shared]')].forEach(o => o.remove());
  sharedWithMeList.forEach(s => {
    const opt = document.createElement('option');
    opt.value = 'shared:' + s.ownerUid;
    opt.dataset.shared = '1';
    opt.textContent = 'Библиотека: ' + (s.ownerEmail || s.ownerUid);
    librarySwitcher.appendChild(opt);
  });
  librarySwitcher.value = currentValue;
}

// ---------- Модальное окно доступа ----------
shareBtn.addEventListener('click', () => {
  shareStatus.textContent = '';
  shareEmailInput.value = '';
  renderSharesList();
  showModal(shareModal);
});
shareCloseBtn.addEventListener('click', () => hideModal(shareModal));

function renderSharesList() {
  if (sharesList.length === 0) {
    sharesListEl.innerHTML = '<p class="shares-empty">Пока ни с кем не поделились.</p>';
    return;
  }
  sharesListEl.innerHTML = sharesList.map(s => `
    <div class="share-item">
      <span>${escapeHtml(s.viewerEmail || s.id)}</span>
      <button class="btn-icon danger" data-revoke="${s.id}" title="Отозвать доступ">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="var(--danger)" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
    </div>`).join('');

  sharesListEl.querySelectorAll('[data-revoke]').forEach(btn => {
    btn.addEventListener('click', () => revokeShare(btn.dataset.revoke));
  });
}

shareSubmitBtn.addEventListener('click', async () => {
  const email = normalizeEmail(shareEmailInput.value);
  if (!email) {
    shareStatus.textContent = 'Введите email.';
    return;
  }
  if (email === normalizeEmail(currentUser.email)) {
    shareStatus.textContent = 'Нельзя дать доступ самой(ому) себе.';
    return;
  }
  shareStatus.textContent = 'Ищем пользователя...';
  try {
    const mappingSnap = await getDoc(doc(db, 'usersByEmail', email));
    if (!mappingSnap.exists()) {
      shareStatus.textContent = 'Пользователь с этим email ещё не зарегистрировался в приложении.';
      return;
    }
    const viewerUid = mappingSnap.data().uid;
    await setDoc(doc(db, 'users', currentUser.uid, 'shares', viewerUid), {
      viewerEmail: email,
      addedAt: serverTimestamp()
    });
    await setDoc(doc(db, 'users', viewerUid, 'sharedWithMe', currentUser.uid), {
      ownerEmail: currentUser.email,
      addedAt: serverTimestamp()
    });
    shareStatus.textContent = 'Доступ предоставлен!';
    shareEmailInput.value = '';
  } catch (err) {
    console.error(err);
    shareStatus.textContent = 'Не удалось предоставить доступ.';
  }
});

async function revokeShare(viewerUid) {
  try {
    await deleteDoc(doc(db, 'users', currentUser.uid, 'shares', viewerUid));
    await deleteDoc(doc(db, 'users', viewerUid, 'sharedWithMe', currentUser.uid));
    showToast('Доступ отозван');
  } catch (err) {
    console.error(err);
    showToast('Не удалось отозвать доступ');
  }
}

// ---------- Сортировка ----------
function sortBooks(books) {
  const sorted = [...books];
  switch (sortSelect.value) {
    case 'date-asc':
      sorted.sort((a, b) => addedAtMillis(a) - addedAtMillis(b));
      break;
    case 'title-asc':
      sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru'));
      break;
    case 'author-asc':
      sorted.sort((a, b) => (a.author || '').localeCompare(b.author || '', 'ru'));
      break;
    case 'rating-desc':
      sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case 'date-desc':
    default:
      sorted.sort((a, b) => addedAtMillis(b) - addedAtMillis(a));
  }
  return sorted;
}

// ---------- Рендер текущего раздела ----------
function renderCurrentView() {
  if (currentView.type === 'wishlist') {
    renderWishlist();
  } else {
    renderBooks();
  }
}

function updateGenreFilterOptions() {
  const genres = [...new Set(allBooks.map(b => b.genre).filter(Boolean))].sort();
  const currentValue = genreFilter.value;
  genreFilter.innerHTML = '<option value="">Все жанры</option>' +
    genres.map(g => `<option value="${g}">${g}</option>`).join('');
  genreFilter.value = currentValue;

  genreList.innerHTML = genres.map(g => `<option value="${g}">`).join('');
}

const HOUR_GREETING = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
};

function renderGreeting() {
  const name = (currentUser.displayName || '').trim() || (currentUser.email || '').split('@')[0];
  greetingTitle.textContent = `${HOUR_GREETING()}${name ? ', ' + name : ''}`;
  const total = allBooks.length;
  const lent = allBooks.filter(b => b.status === 'lent').length;
  const overdue = allBooks.filter(isOverdue).length;
  let subtitle = total === 0 ? 'Ваша библиотека пока пуста' : `В вашей библиотеке ${total} ${pluralBooks(total)}`;
  if (lent > 0) subtitle += ` · ${lent} на руках у друзей`;
  if (overdue > 0) subtitle += ` · ${overdue} просрочено`;
  greetingSubtitle.textContent = subtitle;
}

editNameBtn.addEventListener('click', () => {
  displayNameInput.value = currentUser.displayName || '';
  showModal(nameModal);
  displayNameInput.focus();
});
nameCancelBtn.addEventListener('click', () => hideModal(nameModal));

nameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = displayNameInput.value.trim();
  try {
    await updateProfile(currentUser, { displayName: value });
    renderGreeting();
    hideModal(nameModal);
    showToast(value ? 'Имя сохранено' : 'Имя сброшено');
  } catch (err) {
    console.error(err);
    showToast('Не удалось сохранить имя');
  }
});

function pluralBooks(n) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'книга';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'книги';
  return 'книг';
}

function renderReadingShelf() {
  const reading = allBooks.filter(b => b.readStatus === 'reading');
  readingShelfRow.innerHTML = reading.map(b => `
    <div class="shelf-item" title="${escapeHtml(b.title || '')}">
      <div class="shelf-cover">${coverHtml(b.cover)}</div>
      <p class="shelf-title">${escapeHtml(b.title || '')}</p>
    </div>`).join('');
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motionOK = () => typeof gsap !== 'undefined' && !prefersReducedMotion();

// ---------- Единый вход на страницу (выполняется один раз после логина) ----------
function animatePageEntrance() {
  if (!motionOK()) return;
  const topbarEl = document.querySelector('.topbar');
  const statItems = document.querySelectorAll('.stat-item');

  const tl = gsap.timeline();
  tl.fromTo('#app-screen', { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.out' }, 0);
  if (topbarEl) tl.fromTo(topbarEl, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 0.05);
  if (greetingBlock && !greetingBlock.classList.contains('hidden')) {
    tl.fromTo(greetingBlock, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 0.16);
  }
  if (statItems.length) {
    tl.fromTo(statItems, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.06 }, 0.24);
  }
  return tl;
}

// ---------- Появление карточек при обычной перерисовке (не на каждый рендер целиком, только новые карточки) ----------
function animateEnteringCards(els) {
  if (!motionOK() || !els.length) return;
  gsap.fromTo(els, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: Math.min(0.035, 0.3 / els.length) });
}

// ---------- Счётчики статистики ----------
function animateCounters() {
  if (!motionOK()) return;
  [statTotal, statLent, statAvailable, statOverdue].forEach(el => {
    const target = Number(el.textContent) || 0;
    const obj = { v: 0 };
    gsap.to(obj, { v: target, duration: 0.6, ease: 'power1.out', onUpdate: () => { el.textContent = Math.round(obj.v); } });
  });
}

// ---------- Hover-взаимодействие карточки (subtle: y -4, обложка scale 1.03) ----------
function attachCardHoverMotion(card) {
  const getCoverTarget = () => card.querySelector('.book-cover-wrap img, .cover-placeholder svg');
  card.addEventListener('mouseenter', () => {
    if (!motionOK()) return;
    gsap.to(card, { y: -4, duration: 0.28, ease: 'power2.out', overwrite: 'auto' });
    const cover = getCoverTarget();
    if (cover) gsap.to(cover, { scale: 1.03, duration: 0.32, ease: 'power2.out', overwrite: 'auto' });
  });
  card.addEventListener('mouseleave', () => {
    if (!motionOK()) return;
    gsap.to(card, { y: 0, duration: 0.28, ease: 'power2.out', overwrite: 'auto' });
    const cover = getCoverTarget();
    if (cover) gsap.to(cover, { scale: 1, duration: 0.32, ease: 'power2.out', overwrite: 'auto' });
  });
}

// ---------- Клик по карточке (открытие просмотра / выбор) — вешается один раз на persistent-элемент ----------
function attachCardClickHandler(card) {
  card.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('.select-check')) return;
    const isSharedNow = currentView.type === 'shared';
    if (selectMode && !isSharedNow) { toggleSelect(card.dataset.id); return; }
    if (card._book) openViewModal(card._book, isSharedNow);
  });
}

// ---------- Плавное появление карточек ниже экрана при скролле большой библиотеки ----------
function setupCardScrollReveal() {
  if (gridScrollCtx) { gridScrollCtx.revert(); gridScrollCtx = null; }
  if (!motionOK() || typeof ScrollTrigger === 'undefined') return;
  gridScrollCtx = gsap.context(() => {
    const cards = [...bookGrid.querySelectorAll('.book-card')];
    ScrollTrigger.batch(cards, {
      start: 'top 90%',
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.04, overwrite: 'auto' })
    });
  });
}

function showModal(el) {
  el.classList.remove('hidden');
  if (!motionOK()) return;
  const card = el.querySelector('.modal');
  gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power1.out' });
  if (card) gsap.fromTo(card, { opacity: 0, scale: 0.96, y: 10 }, { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'power2.out' });
}

function hideModal(el) {
  if (!motionOK()) { el.classList.add('hidden'); return; }
  const card = el.querySelector('.modal');
  gsap.to(el, { opacity: 0, duration: 0.18, ease: 'power1.in', onComplete: () => el.classList.add('hidden') });
  if (card) gsap.to(card, { opacity: 0, scale: 0.96, y: 10, duration: 0.18, ease: 'power1.in' });
}

function bindCardButtons(card, b, isShared) {
  if (isShared) {
    card.querySelector(`#like-${b.id}`)?.addEventListener('click', () => toggleLikeFromShared(b));
  } else {
    card.querySelector(`#edit-${b.id}`)?.addEventListener('click', () => openEditModal(b));
    card.querySelector(`#delete-${b.id}`)?.addEventListener('click', () => handleDelete(b));
    card.querySelector(`#lend-${b.id}`)?.addEventListener('click', () => openLendModal([b.id]));
    card.querySelector(`#return-${b.id}`)?.addEventListener('click', () => handleReturn(b));
    card.querySelector(`#check-${b.id}`)?.addEventListener('click', (e) => { e.stopPropagation(); toggleSelect(b.id); });
  }
}

function renderBooks() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const genre = genreFilter.value;
  const status = statusFilter.value;
  const readStatus = readStatusFilter.value;
  const isShared = currentView.type === 'shared';
  const isMine = currentView.type === 'mine';

  const filtered = allBooks.filter(b => {
    const matchesSearch = !searchTerm ||
      (b.title || '').toLowerCase().includes(searchTerm) ||
      (b.author || '').toLowerCase().includes(searchTerm);
    const matchesGenre = !genre || b.genre === genre;
    const matchesStatus = !status || b.status === status;
    const matchesReadStatus = !readStatus || b.readStatus === readStatus;
    return matchesSearch && matchesGenre && matchesStatus && matchesReadStatus;
  });

  const sorted = sortBooks(filtered);

  if (isMine) {
    statTotal.textContent = allBooks.length;
    statLent.textContent = allBooks.filter(b => b.status === 'lent').length;
    statAvailable.textContent = allBooks.filter(b => b.status !== 'lent').length;
    statOverdue.textContent = allBooks.filter(isOverdue).length;
    renderGreeting();
    renderReadingShelf();
  }
  greetingBlock.classList.toggle('hidden', !isMine);
  readingShelf.classList.toggle('hidden', !isMine || allBooks.filter(b => b.readStatus === 'reading').length === 0);

  emptyState.classList.toggle('hidden', allBooks.length > 0);
  bookGrid.classList.toggle('view-list', viewMode === 'list');

  if (isMine && !hasAnimatedPageEntrance) {
    hasAnimatedPageEntrance = true;
    animatePageEntrance();
  }

  // ---- Flip: снимок текущих позиций карточек ДО перестройки DOM ----
  const canFlip = typeof Flip !== 'undefined' && motionOK();
  const existingBefore = [...bookCardEls.values()].filter(el => el.isConnected);
  const flipState = canFlip && existingBefore.length ? Flip.getState(existingBefore) : null;

  // ---- убираем карточки, которых больше нет в отфильтрованном списке ----
  const newIds = new Set(sorted.map(b => String(b.id)));
  for (const [id, el] of [...bookCardEls]) {
    if (!newIds.has(id)) { el.remove(); bookCardEls.delete(id); }
  }

  // ---- создаём недостающие карточки, обновляем содержимое, расставляем в нужном порядке ----
  const enteringEls = [];
  sorted.forEach(b => {
    const id = String(b.id);
    let card = bookCardEls.get(id);
    if (!card) {
      card = document.createElement('div');
      card.className = 'book-card';
      card.dataset.id = id;
      bookCardEls.set(id, card);
      enteringEls.push(card);
      attachCardHoverMotion(card);
      attachCardClickHandler(card);
    }
    card._book = b;
    card.innerHTML = bookCardInnerHtml(b, isShared);
    bookGrid.appendChild(card);
    bindCardButtons(card, b, isShared);
  });

  if (canFlip && flipState) {
    Flip.from(flipState, {
      duration: 0.45,
      ease: 'power2.out',
      absolute: true,
      onEnter: els => gsap.fromTo(els, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.03 }),
      onLeave: els => gsap.to(els, { opacity: 0, scale: 0.95, duration: 0.2 })
    });
  } else {
    animateEnteringCards(enteringEls);
  }

  if (isMine) applySelectModeClasses();
  if (isMine) animateCounters();
  setupCardScrollReveal();
}

emptyAddBtn.addEventListener('click', () => addBookBtn.click());

function starRowHtml(rating) {
  if (!rating) return '';
  const r = Math.round(rating);
  let html = '<div class="star-row">';
  for (let i = 1; i <= 5; i++) {
    html += i <= r ? '★' : '<span class="empty">★</span>';
  }
  html += '</div>';
  return html;
}

function bookCardInnerHtml(b, readOnly) {
  const isLent = b.status === 'lent';
  const overdue = isOverdue(b);
  const isLiked = readOnly && allWishlist.some(w => w.sourceOwnerUid === currentView.ownerUid && w.sourceBookId === b.id);

  const likeButton = readOnly ? `
      <button class="like-icon-btn ${isLiked ? 'liked' : ''}" id="like-${b.id}" title="${isLiked ? 'Убрать из желаний' : 'Добавить в желания'}">
        <svg class="heart-outline" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 20C12 20 4 15 4 9.5C4 6.5 6.2 4.5 8.8 4.5C10.2 4.5 11.4 5.2 12 6.2C12.6 5.2 13.8 4.5 15.2 4.5C17.8 4.5 20 6.5 20 9.5C20 15 12 20 12 20Z" stroke="var(--danger)" stroke-width="1.8" stroke-linejoin="round"/></svg>
        <svg class="heart-filled" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 20C12 20 4 15 4 9.5C4 6.5 6.2 4.5 8.8 4.5C10.2 4.5 11.4 5.2 12 6.2C12.6 5.2 13.8 4.5 15.2 4.5C17.8 4.5 20 6.5 20 9.5C20 15 12 20 12 20Z" fill="var(--danger)"/></svg>
      </button>` : '';

  const actionsHtml = readOnly ? '' : `
      <div class="card-actions">
        <button class="btn btn-ghost" id="edit-${b.id}">Изменить</button>
        ${isLent
          ? `<button class="btn btn-secondary" id="return-${b.id}">Вернули</button>`
          : `<button class="btn btn-secondary" id="lend-${b.id}">Выдать</button>`}
        <button class="btn-icon danger" id="delete-${b.id}" title="Удалить">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 7H18M9 7V5C9 4.45 9.45 4 10 4H14C14.55 4 15 4.45 15 5V7M17 7V19C17 19.55 16.55 20 16 20H8C7.45 20 7 19.55 7 19V7H17Z" stroke="var(--danger)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>`;

  const selectCheck = readOnly ? '' : `
      <div class="select-check" id="check-${b.id}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13L10 18L19 7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>`;

  return `
      ${selectCheck}
      ${likeButton}
      <div class="book-cover-wrap">${coverHtml(b.cover)}</div>
      <div>
        <p class="book-title">${escapeHtml(b.title || '')}</p>
        <p class="book-author">${escapeHtml(b.author || '')}</p>
        ${starRowHtml(b.rating)}
        <div class="card-reveal">
          ${bookMetaHtml(b)}
          <div class="badge-row">
            ${b.genre ? `<span class="badge badge-genre">${escapeHtml(b.genre)}</span>` : ''}
            ${b.shelf ? `<span class="badge badge-shelf">${escapeHtml(b.shelf)}</span>` : ''}
            ${readOnly ? '' : `<span class="badge ${isLent ? 'badge-lent' : 'badge-available'}">${isLent ? 'Выдано' : 'В наличии'}</span>`}
            ${overdue && !readOnly ? `<span class="badge badge-overdue">Просрочено</span>` : ''}
            ${b.readStatus ? `<span class="badge ${READ_STATUS_CLASS[b.readStatus]}">${READ_STATUS_LABELS[b.readStatus]}</span>` : ''}
            ${b.quotes && b.quotes.length ? `<span class="badge badge-quotes">${QUOTE_ICON_SVG} ${b.quotes.length}</span>` : ''}
          </div>
          ${b.notes ? `<p class="book-notes">${escapeHtml(b.notes)}</p>` : ''}
        </div>
        ${isLent && !readOnly ? `
          <div class="lend-info ${overdue ? 'overdue' : ''}">
            Взял(а): <b>${escapeHtml(b.borrower || '')}</b><br>
            С ${formatDate(b.lendDate)}${b.dueDate ? ` до ${formatDate(b.dueDate)}` : ''}
          </div>` : ''}
      </div>
      ${actionsHtml}`;
}

// ---------- Желания ----------
function renderWishlist() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const filtered = allWishlist.filter(w =>
    !searchTerm ||
    (w.title || '').toLowerCase().includes(searchTerm) ||
    (w.author || '').toLowerCase().includes(searchTerm)
  );

  emptyState.classList.toggle('hidden', allWishlist.length > 0);
  bookGrid.classList.toggle('view-list', viewMode === 'list');
  bookGrid.innerHTML = filtered.map(wishCardHtml).join('');

  filtered.forEach(w => {
    document.getElementById(`wish-remove-${w.id}`)?.addEventListener('click', () => handleWishlistRemove(w.id));
    document.getElementById(`wish-edit-${w.id}`)?.addEventListener('click', () => openWishlistModal(w));
  });
  animateEnteringCards([...bookGrid.querySelectorAll('.book-card')]);
}

function wishCardHtml(w) {
  return `
    <div class="book-card" data-id="${w.id}">
      <div class="book-cover-wrap">${coverHtml(w.cover)}</div>
      <div>
        <p class="book-title">${escapeHtml(w.title || '')}</p>
        <p class="book-author">${escapeHtml(w.author || '')}</p>
        ${w.fromLibrary ? `<p class="book-meta">Из библиотеки: ${escapeHtml(w.fromLibrary)}</p>` : ''}
      </div>
      <div class="card-actions">
        <button class="btn btn-ghost" id="wish-edit-${w.id}">Изменить</button>
        <button class="btn btn-secondary" id="wish-remove-${w.id}">Убрать</button>
      </div>
    </div>`;
}

addBookBtn.addEventListener('click', () => {
  if (currentView.type === 'wishlist') {
    openWishlistModal(null);
  } else {
    openAddModal();
  }
});

wishlistCancelBtn.addEventListener('click', () => hideModal(wishlistModal));

function openWishlistModal(item) {
  wishlistForm.reset();
  if (item) {
    wishlistModalTitle.textContent = 'Изменить желание';
    wishlistIdInput.value = item.id;
    wishlistTitleInput.value = item.title || '';
    wishlistAuthorInput.value = item.author || '';
    wishlistCoverInput.value = item.cover || '';
  } else {
    wishlistModalTitle.textContent = 'Добавить в желания';
    wishlistIdInput.value = '';
  }
  showModal(wishlistModal);
}

wishlistForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = wishlistIdInput.value;
  const data = {
    title: wishlistTitleInput.value.trim(),
    author: wishlistAuthorInput.value.trim(),
    cover: toHttps(wishlistCoverInput.value.trim())
  };
  try {
    if (id) {
      await updateDoc(doc(db, 'users', currentUser.uid, 'wishlist', id), data);
      showToast('Желание обновлено');
    } else {
      await addDoc(wishlistCollectionRef(), {
        ...data,
        fromLibrary: '',
        addedAt: serverTimestamp()
      });
      showToast('Добавлено в желания');
    }
    hideModal(wishlistModal);
  } catch (err) {
    console.error(err);
    showToast('Не удалось сохранить');
  }
});

async function toggleLikeFromShared(book) {
  const existing = allWishlist.find(w => w.sourceOwnerUid === currentView.ownerUid && w.sourceBookId === book.id);
  try {
    if (existing) {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'wishlist', existing.id));
      showToast('Убрано из желаний');
    } else {
      await addDoc(wishlistCollectionRef(), {
        title: book.title || '',
        author: book.author || '',
        cover: book.cover || '',
        fromLibrary: currentView.ownerEmail || '',
        sourceOwnerUid: currentView.ownerUid,
        sourceBookId: book.id,
        addedAt: serverTimestamp()
      });
      showToast('Добавлено в желания');
    }
  } catch (err) {
    console.error(err);
    showToast('Не удалось обновить желания');
  }
}

async function handleWishlistRemove(id) {
  try {
    await deleteDoc(doc(db, 'users', currentUser.uid, 'wishlist', id));
  } catch (err) {
    console.error(err);
    showToast('Не удалось удалить');
  }
}

// ---------- Переключение вида сетка/список ----------
function applyViewModeButtons() {
  gridViewBtn.classList.toggle('active', viewMode === 'grid');
  listViewBtn.classList.toggle('active', viewMode === 'list');
}
gridViewBtn.addEventListener('click', () => { viewMode = 'grid'; localStorage.setItem('viewMode', viewMode); applyViewModeButtons(); renderCurrentView(); });
listViewBtn.addEventListener('click', () => { viewMode = 'list'; localStorage.setItem('viewMode', viewMode); applyViewModeButtons(); renderCurrentView(); });
applyViewModeButtons();

// ---------- Выбор нескольких книг для массовой выдачи ----------
selectModeBtn.addEventListener('click', () => {
  selectMode = !selectMode;
  selectedIds.clear();
  selectModeBtn.textContent = selectMode ? 'Отменить выбор' : 'Выбрать';
  applySelectModeClasses();
  updateBulkBar();
});

function applySelectModeClasses() {
  document.querySelectorAll('.book-card').forEach(card => {
    const id = card.dataset.id;
    card.classList.toggle('selectable', selectMode);
    card.classList.toggle('selected', selectedIds.has(id));
    const check = card.querySelector('.select-check');
    if (check) check.classList.toggle('checked', selectedIds.has(id));
  });
}

function toggleSelect(id) {
  if (!selectMode) return;
  if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
  applySelectModeClasses();
  updateBulkBar();
}

function updateBulkBar() {
  bulkCount.textContent = `Выбрано: ${selectedIds.size}`;
  bulkBar.classList.toggle('hidden', selectedIds.size === 0);
}

bulkCancelBtn.addEventListener('click', () => {
  selectMode = false;
  selectedIds.clear();
  selectModeBtn.textContent = 'Выбрать';
  applySelectModeClasses();
  updateBulkBar();
});

bulkLendBtn.addEventListener('click', () => {
  if (selectedIds.size === 0) return;
  openLendModal([...selectedIds]);
});

searchInput.addEventListener('input', renderCurrentView);
genreFilter.addEventListener('change', renderBooks);
statusFilter.addEventListener('change', renderBooks);
readStatusFilter.addEventListener('change', renderBooks);
sortSelect.addEventListener('change', renderBooks);

// ---------- Звёздный рейтинг в форме ----------
function setStarRating(value) {
  bookRatingInput.value = value;
  [...starPicker.children].forEach(btn => {
    btn.classList.toggle('filled', Number(btn.dataset.value) <= value);
  });
}

starPicker.addEventListener('click', (e) => {
  const btn = e.target.closest('.star-btn');
  if (!btn) return;
  const value = Number(btn.dataset.value);
  setStarRating(Number(bookRatingInput.value) === value ? 0 : value);
});

// ---------- Цитаты и быстрые заметки ----------
function renderQuotes() {
  if (quotesDraft.length === 0) {
    quotesListEl.innerHTML = '';
    return;
  }
  quotesListEl.innerHTML = quotesDraft.map((q, i) => `
    <div class="quote-item">
      <div><span class="quote-text">${escapeHtml(q.text)}</span><span class="quote-date">${formatDate(q.date)}</span></div>
      <button type="button" class="quote-remove" data-index="${i}" title="Удалить">✕</button>
    </div>`).join('');

  quotesListEl.querySelectorAll('.quote-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      quotesDraft.splice(Number(btn.dataset.index), 1);
      renderQuotes();
    });
  });
}

quoteAddBtn.addEventListener('click', () => {
  const text = quoteInput.value.trim();
  if (!text) return;
  quotesDraft.push({ text, date: todayIso() });
  quoteInput.value = '';
  renderQuotes();
});
quoteInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); quoteAddBtn.click(); }
});

// ---------- Загрузка обложки с компьютера ----------
coverUploadInput.addEventListener('change', () => {
  const file = coverUploadInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 480;
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      bookCoverInput.value = dataUrl;
      coverPreview.src = dataUrl;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

// ---------- Просмотр карточки книги ----------
function openViewModal(book, readOnly) {
  viewedBook = book;
  viewCover.innerHTML = coverHtml(book.cover);
  viewTitle.textContent = book.title || '';
  viewAuthor.textContent = book.author || '';
  viewMeta.innerHTML = bookMetaHtml(book);
  viewStars.innerHTML = starRowHtml(book.rating);

  const isLent = book.status === 'lent';
  const overdue = isOverdue(book);
  const badges = [];
  if (book.genre) badges.push(`<span class="badge badge-genre">${escapeHtml(book.genre)}</span>`);
  if (book.shelf) badges.push(`<span class="badge badge-shelf">${escapeHtml(book.shelf)}</span>`);
  if (!readOnly) badges.push(`<span class="badge ${isLent ? 'badge-lent' : 'badge-available'}">${isLent ? 'Выдано' : 'В наличии'}</span>`);
  if (overdue && !readOnly) badges.push(`<span class="badge badge-overdue">Просрочено</span>`);
  if (book.readStatus) badges.push(`<span class="badge ${READ_STATUS_CLASS[book.readStatus]}">${READ_STATUS_LABELS[book.readStatus]}</span>`);
  viewBadges.innerHTML = badges.join('');

  viewLendInfo.innerHTML = (isLent && !readOnly) ? `
    <div class="lend-info ${overdue ? 'overdue' : ''}">
      Взял(а): <b>${escapeHtml(book.borrower || '')}</b><br>
      С ${formatDate(book.lendDate)}${book.dueDate ? ` до ${formatDate(book.dueDate)}` : ''}
    </div>` : '';

  if (book.notes) {
    viewNotesSection.classList.remove('hidden');
    viewNotes.textContent = book.notes;
  } else {
    viewNotesSection.classList.add('hidden');
  }

  const quotes = Array.isArray(book.quotes) ? book.quotes : [];
  if (quotes.length) {
    viewQuotesSection.classList.remove('hidden');
    viewQuotesList.innerHTML = quotes.map(q => `
      <div class="quote-item">
        <div><span class="quote-text">${escapeHtml(q.text)}</span><span class="quote-date">${formatDate(q.date)}</span></div>
      </div>`).join('');
  } else {
    viewQuotesSection.classList.add('hidden');
  }

  viewEditBtn.classList.toggle('hidden', readOnly);
  showModal(viewModal);
}

viewCloseBtn.addEventListener('click', () => hideModal(viewModal));
viewEditBtn.addEventListener('click', () => {
  hideModal(viewModal);
  if (viewedBook) openEditModal(viewedBook);
});

// ---------- Добавление / редактирование книги ----------
bookCancelBtn.addEventListener('click', () => hideModal(bookModal));

function openAddModal() {
  bookModalTitle.textContent = 'Добавить книгу';
  bookForm.reset();
  bookIdInput.value = '';
  bookCoverInput.value = '';
  coverPreview.src = '';
  isbnStatus.textContent = '';
  setStarRating(0);
  quotesDraft = [];
  renderQuotes();
  showModal(bookModal);
}

function openEditModal(book) {
  bookModalTitle.textContent = 'Изменить книгу';
  bookIdInput.value = book.id;
  bookIsbnInput.value = book.isbn || '';
  bookTitleInput.value = book.title || '';
  bookAuthorInput.value = book.author || '';
  bookGenreInput.value = book.genre || '';
  bookShelfInput.value = book.shelf || '';
  bookPublisherInput.value = book.publisher || '';
  bookYearInput.value = book.year || '';
  bookPagesInput.value = book.pages || '';
  bookCoverInput.value = toHttps(book.cover || '');
  coverPreview.src = toHttps(book.cover || '');
  bookReadStatusInput.value = book.readStatus || '';
  bookNotesInput.value = book.notes || '';
  setStarRating(book.rating || 0);
  quotesDraft = Array.isArray(book.quotes) ? [...book.quotes] : [];
  renderQuotes();
  isbnStatus.textContent = '';
  showModal(bookModal);
}

bookForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = bookIdInput.value;
  const data = {
    isbn: bookIsbnInput.value.trim(),
    title: bookTitleInput.value.trim(),
    author: bookAuthorInput.value.trim(),
    genre: bookGenreInput.value.trim(),
    shelf: bookShelfInput.value.trim(),
    publisher: bookPublisherInput.value.trim(),
    year: bookYearInput.value.trim(),
    pages: bookPagesInput.value.trim(),
    cover: toHttps(bookCoverInput.value.trim()),
    readStatus: bookReadStatusInput.value,
    notes: bookNotesInput.value.trim(),
    rating: Number(bookRatingInput.value) || 0,
    quotes: quotesDraft
  };

  try {
    if (id) {
      await updateDoc(doc(db, 'users', currentUser.uid, 'books', id), data);
      showToast('Книга обновлена');
    } else {
      await addDoc(booksCollectionRef(currentUser.uid), {
        ...data,
        status: 'available',
        borrower: '',
        lendDate: '',
        dueDate: '',
        addedAt: serverTimestamp()
      });
      showToast('Книга добавлена');
    }
    hideModal(bookModal);
  } catch (err) {
    console.error(err);
    showToast('Не удалось сохранить книгу');
  }
});

async function handleDelete(book) {
  if (!confirm(`Удалить «${book.title}» из каталога?`)) return;
  try {
    await deleteDoc(doc(db, 'users', currentUser.uid, 'books', book.id));
    showToast('Книга удалена');
  } catch (err) {
    console.error(err);
    showToast('Не удалось удалить книгу');
  }
}

// ---------- Поиск по ISBN (Google Books, с резервом ISBN-10/13 и Open Library) ----------
function isbn10to13(isbn10) {
  const core = '978' + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return core + check;
}

function isbn13to10(isbn13) {
  if (!isbn13.startsWith('978')) return null;
  const core = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(core[i]) * (10 - i);
  let check = (11 - (sum % 11)) % 11;
  const checkChar = check === 10 ? 'X' : String(check);
  return core + checkChar;
}

function alternateIsbn(isbn) {
  if (isbn.length === 10) return isbn10to13(isbn);
  if (isbn.length === 13) return isbn13to10(isbn);
  return null;
}

async function fetchFromGoogleBooks(isbn) {
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`);
  if (!res.ok) throw new Error('google-books-http-' + res.status);
  const data = await res.json();
  const info = data.items?.[0]?.volumeInfo;
  if (!info) return null;
  return {
    title: info.title || '',
    author: (info.authors || []).join(', '),
    genre: (info.categories || [])[0] || '',
    publisher: info.publisher || '',
    year: (info.publishedDate || '').slice(0, 4),
    pages: info.pageCount || '',
    cover: toHttps(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '')
  };
}

async function fetchFromOpenLibrary(isbn) {
  const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`);
  if (!res.ok) throw new Error('open-library-http-' + res.status);
  const data = await res.json();
  const info = data[`ISBN:${isbn}`];
  if (!info) return null;
  return {
    title: info.title || '',
    author: (info.authors || []).map(a => a.name).join(', '),
    genre: (info.subjects || [])[0]?.name || '',
    publisher: (info.publishers || [])[0]?.name || '',
    year: (info.publish_date || '').match(/\d{4}/)?.[0] || '',
    pages: info.number_of_pages || '',
    cover: toHttps(info.cover?.large || info.cover?.medium || '')
  };
}

function fillBookForm(result) {
  bookTitleInput.value = result.title;
  bookAuthorInput.value = result.author;
  bookGenreInput.value = result.genre;
  bookPublisherInput.value = result.publisher;
  bookYearInput.value = result.year;
  bookPagesInput.value = result.pages;
  bookCoverInput.value = result.cover;
  coverPreview.src = result.cover;
}

isbnLookupBtn.addEventListener('click', async () => {
  const rawIsbn = bookIsbnInput.value.trim().replace(/[-\s]/g, '');
  if (!rawIsbn) {
    isbnStatus.textContent = 'Введите ISBN для поиска.';
    return;
  }
  isbnStatus.textContent = 'Ищем книгу...';
  isbnLookupBtn.disabled = true;

  const candidates = [rawIsbn, alternateIsbn(rawIsbn)].filter(Boolean);

  try {
    let result = null;
    let source = '';

    for (const code of candidates) {
      try {
        result = await fetchFromGoogleBooks(code);
        if (result) { source = 'Google Books'; break; }
      } catch (err) { console.warn(err); }
    }

    if (!result) {
      for (const code of candidates) {
        try {
          result = await fetchFromOpenLibrary(code);
          if (result) { source = 'Open Library'; break; }
        } catch (err) { console.warn(err); }
      }
    }

    if (!result) {
      isbnStatus.textContent = 'По этому ISBN ничего не найдено ни в Google Books, ни в Open Library. Часто так бывает с российскими изданиями — заполните поля вручную.';
      return;
    }

    fillBookForm(result);
    isbnStatus.textContent = result.cover
      ? `Данные найдены (${source}) и подставлены в форму.`
      : `Данные найдены (${source}), но без обложки — вставьте ссылку вручную, если есть.`;
  } catch (err) {
    console.error(err);
    isbnStatus.textContent = 'Не удалось выполнить запрос — проверьте интернет-соединение и попробуйте ещё раз.';
  } finally {
    isbnLookupBtn.disabled = false;
  }
});

// ---------- Выдача / возврат книги (в т.ч. массовая) ----------
function openLendModal(bookIds) {
  lendBookIdInput.value = bookIds.join(',');
  lendModalTitle.textContent = bookIds.length > 1 ? `Выдать книги (${bookIds.length})` : 'Выдать книгу';
  lendForm.reset();
  lendDateInput.value = todayIso();
  showModal(lendModal);
}

lendCancelBtn.addEventListener('click', () => hideModal(lendModal));

lendForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const ids = lendBookIdInput.value.split(',').filter(Boolean);
  const payload = {
    status: 'lent',
    borrower: lendBorrowerInput.value.trim(),
    lendDate: lendDateInput.value,
    dueDate: lendDueDateInput.value || ''
  };
  try {
    await Promise.all(ids.map(id => updateDoc(doc(db, 'users', currentUser.uid, 'books', id), payload)));
    hideModal(lendModal);
    selectMode = false;
    selectedIds.clear();
    selectModeBtn.textContent = 'Выбрать';
    updateBulkBar();
    showToast(ids.length > 1 ? 'Книги отмечены как выданные' : 'Книга отмечена как выданная');
  } catch (err) {
    console.error(err);
    showToast('Не удалось сохранить выдачу');
  }
});

async function handleReturn(book) {
  try {
    await updateDoc(doc(db, 'users', currentUser.uid, 'books', book.id), {
      status: 'available',
      borrower: '',
      lendDate: '',
      dueDate: ''
    });
    showToast('Книга отмечена как возвращённая');
  } catch (err) {
    console.error(err);
    showToast('Не удалось обновить статус');
  }
}

// ---------- Статистика по жанрам ----------
statsBtn.addEventListener('click', () => {
  renderStatsChart();
  showModal(statsModal);
});
statsCloseBtn.addEventListener('click', () => hideModal(statsModal));

function renderStatsChart() {
  const counts = {};
  allBooks.forEach(b => {
    const genre = b.genre || 'Без жанра';
    counts[genre] = (counts[genre] || 0) + 1;
  });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    statsChart.innerHTML = '<p class="stats-empty">Пока нет книг для статистики.</p>';
    return;
  }

  const max = entries[0][1];
  statsChart.innerHTML = entries.map(([genre, count], i) => {
    const pct = Math.round((count / max) * 100);
    const color = `var(${GENRE_COLORS[i % GENRE_COLORS.length]})`;
    return `
      <div class="stats-bar-row">
        <div class="stats-bar-label"><span>${escapeHtml(genre)}</span><span>${count}</span></div>
        <div class="stats-bar-track">
          <div class="stats-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>`;
  }).join('');
}

// ---------- Экспорт в CSV ----------
exportCsvBtn.addEventListener('click', () => {
  if (allBooks.length === 0) {
    showToast('В библиотеке пока нет книг для экспорта');
    return;
  }
  const headers = ['Название', 'Автор', 'Жанр', 'Издательство', 'Год', 'Страниц', 'Полка', 'ISBN', 'Статус выдачи', 'Кому выдана', 'Дата выдачи', 'Вернуть до', 'Статус чтения', 'Оценка', 'Заметки'];
  const rows = allBooks.map(b => [
    b.title || '', b.author || '', b.genre || '', b.publisher || '', b.year || '', b.pages || '', b.shelf || '', b.isbn || '',
    b.status === 'lent' ? 'Выдано' : 'В наличии',
    b.borrower || '', b.lendDate || '', b.dueDate || '',
    READ_STATUS_LABELS[b.readStatus] || '', b.rating || '', b.notes || ''
  ]);

  const csvEscape = (val) => {
    const s = String(val).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };

  const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my-library.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
