import { firebaseConfig } from './firebase-config.js';

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let allBooks = [];
let unsubscribeBooks = null;

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

const bookGrid = document.getElementById('book-grid');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const genreFilter = document.getElementById('genre-filter');
const statusFilter = document.getElementById('status-filter');
const addBookBtn = document.getElementById('add-book-btn');

const statTotal = document.getElementById('stat-total');
const statLent = document.getElementById('stat-lent');
const statAvailable = document.getElementById('stat-available');

const bookModal = document.getElementById('book-modal');
const bookForm = document.getElementById('book-form');
const bookModalTitle = document.getElementById('book-modal-title');
const bookIdInput = document.getElementById('book-id');
const bookIsbnInput = document.getElementById('book-isbn');
const isbnLookupBtn = document.getElementById('isbn-lookup-btn');
const isbnStatus = document.getElementById('isbn-status');
const coverPreview = document.getElementById('cover-preview');
const bookCoverInput = document.getElementById('book-cover');
const bookTitleInput = document.getElementById('book-title');
const bookAuthorInput = document.getElementById('book-author');
const bookGenreInput = document.getElementById('book-genre');
const bookShelfInput = document.getElementById('book-shelf');
const genreList = document.getElementById('genre-list');
const bookCancelBtn = document.getElementById('book-cancel-btn');

const lendModal = document.getElementById('lend-modal');
const lendForm = document.getElementById('lend-form');
const lendBookIdInput = document.getElementById('lend-book-id');
const lendBorrowerInput = document.getElementById('lend-borrower');
const lendDateInput = document.getElementById('lend-date');
const lendDueDateInput = document.getElementById('lend-due-date');
const lendCancelBtn = document.getElementById('lend-cancel-btn');

const toast = document.getElementById('toast');

// ---------- Вспомогательные функции ----------
function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2500);
}

function booksCollectionRef() {
  return collection(db, 'users', currentUser.uid, 'books');
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('ru-RU');
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
    // после успешной регистрации onAuthStateChanged сам переключит на основной экран
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

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    userEmailEl.textContent = user.email;
    subscribeToBooks();
  } else {
    appScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    loginForm.reset();
    registerForm.reset();
    loginError.textContent = '';
    registerError.textContent = '';
    if (unsubscribeBooks) unsubscribeBooks();
    allBooks = [];
  }
});

// ---------- Подписка на книги (реальное время) ----------
function subscribeToBooks() {
  const q = query(booksCollectionRef(), orderBy('addedAt', 'desc'));
  unsubscribeBooks = onSnapshot(q, (snapshot) => {
    allBooks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    updateGenreFilterOptions();
    renderBooks();
  }, (error) => {
    console.error(error);
    showToast('Ошибка загрузки данных из Firestore');
  });
}

function updateGenreFilterOptions() {
  const genres = [...new Set(allBooks.map(b => b.genre).filter(Boolean))].sort();
  const currentValue = genreFilter.value;
  genreFilter.innerHTML = '<option value="">Все жанры</option>' +
    genres.map(g => `<option value="${g}">${g}</option>`).join('');
  genreFilter.value = currentValue;

  genreList.innerHTML = genres.map(g => `<option value="${g}">`).join('');
}

// ---------- Рендер карточек ----------
function renderBooks() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const genre = genreFilter.value;
  const status = statusFilter.value;

  const filtered = allBooks.filter(b => {
    const matchesSearch = !searchTerm ||
      (b.title || '').toLowerCase().includes(searchTerm) ||
      (b.author || '').toLowerCase().includes(searchTerm);
    const matchesGenre = !genre || b.genre === genre;
    const matchesStatus = !status || b.status === status;
    return matchesSearch && matchesGenre && matchesStatus;
  });

  statTotal.textContent = allBooks.length;
  statLent.textContent = allBooks.filter(b => b.status === 'lent').length;
  statAvailable.textContent = allBooks.filter(b => b.status !== 'lent').length;

  emptyState.classList.toggle('hidden', allBooks.length > 0);
  bookGrid.innerHTML = filtered.map(bookCardHtml).join('');

  filtered.forEach(b => {
    document.getElementById(`edit-${b.id}`)?.addEventListener('click', () => openEditModal(b));
    document.getElementById(`delete-${b.id}`)?.addEventListener('click', () => handleDelete(b));
    document.getElementById(`lend-${b.id}`)?.addEventListener('click', () => openLendModal(b));
    document.getElementById(`return-${b.id}`)?.addEventListener('click', () => handleReturn(b));
  });
}

function bookCardHtml(b) {
  const isLent = b.status === 'lent';
  const cover = b.cover
    ? `<img src="${b.cover}" alt="">`
    : `<svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M4 4.5C4 3.67 4.67 3 5.5 3H12V21H5.5C4.67 21 4 20.33 4 19.5V4.5Z" fill="#C9B6E4"/><path d="M12 3H18.5C19.33 3 20 3.67 20 4.5V19.5C20 20.33 19.33 21 18.5 21H12V3Z" fill="#B8E3D8"/></svg>`;

  return `
    <div class="book-card">
      <div class="book-cover-wrap">${cover}</div>
      <p class="book-title">${escapeHtml(b.title || '')}</p>
      <p class="book-author">${escapeHtml(b.author || '')}</p>
      <div class="badge-row">
        ${b.genre ? `<span class="badge badge-genre">${escapeHtml(b.genre)}</span>` : ''}
        ${b.shelf ? `<span class="badge badge-shelf">${escapeHtml(b.shelf)}</span>` : ''}
        <span class="badge ${isLent ? 'badge-lent' : 'badge-available'}">${isLent ? 'Выдано' : 'В наличии'}</span>
      </div>
      ${isLent ? `
        <div class="lend-info">
          Взял(а): <b>${escapeHtml(b.borrower || '')}</b><br>
          С ${formatDate(b.lendDate)}${b.dueDate ? ` до ${formatDate(b.dueDate)}` : ''}
        </div>` : ''}
      <div class="card-actions">
        <button class="btn btn-ghost" id="edit-${b.id}">Изменить</button>
        ${isLent
          ? `<button class="btn btn-secondary" id="return-${b.id}">Вернули</button>`
          : `<button class="btn btn-secondary" id="lend-${b.id}">Выдать</button>`}
        <button class="btn-icon danger" id="delete-${b.id}" title="Удалить">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 7H18M9 7V5C9 4.45 9.45 4 10 4H14C14.55 4 15 4.45 15 5V7M17 7V19C17 19.55 16.55 20 16 20H8C7.45 20 7 19.55 7 19V7H17Z" stroke="#B96B6B" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

searchInput.addEventListener('input', renderBooks);
genreFilter.addEventListener('change', renderBooks);
statusFilter.addEventListener('change', renderBooks);

// ---------- Добавление / редактирование книги ----------
addBookBtn.addEventListener('click', () => openAddModal());
bookCancelBtn.addEventListener('click', () => bookModal.classList.add('hidden'));

function openAddModal() {
  bookModalTitle.textContent = 'Добавить книгу';
  bookForm.reset();
  bookIdInput.value = '';
  bookCoverInput.value = '';
  coverPreview.src = '';
  isbnStatus.textContent = '';
  bookModal.classList.remove('hidden');
}

function openEditModal(book) {
  bookModalTitle.textContent = 'Изменить книгу';
  bookIdInput.value = book.id;
  bookIsbnInput.value = book.isbn || '';
  bookTitleInput.value = book.title || '';
  bookAuthorInput.value = book.author || '';
  bookGenreInput.value = book.genre || '';
  bookShelfInput.value = book.shelf || '';
  bookCoverInput.value = book.cover || '';
  coverPreview.src = book.cover || '';
  isbnStatus.textContent = '';
  bookModal.classList.remove('hidden');
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
    cover: bookCoverInput.value.trim()
  };

  try {
    if (id) {
      await updateDoc(doc(db, 'users', currentUser.uid, 'books', id), data);
      showToast('Книга обновлена');
    } else {
      await addDoc(booksCollectionRef(), {
        ...data,
        status: 'available',
        borrower: '',
        lendDate: '',
        dueDate: '',
        addedAt: serverTimestamp()
      });
      showToast('Книга добавлена');
    }
    bookModal.classList.add('hidden');
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

// ---------- Поиск по ISBN через Google Books API ----------
isbnLookupBtn.addEventListener('click', async () => {
  const isbn = bookIsbnInput.value.trim().replace(/[-\s]/g, '');
  if (!isbn) {
    isbnStatus.textContent = 'Введите ISBN для поиска.';
    return;
  }
  isbnStatus.textContent = 'Ищем книгу...';
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`);
    const data = await res.json();
    const info = data.items?.[0]?.volumeInfo;
    if (!info) {
      isbnStatus.textContent = 'По этому ISBN ничего не найдено. Заполните поля вручную.';
      return;
    }
    bookTitleInput.value = info.title || '';
    bookAuthorInput.value = (info.authors || []).join(', ');
    bookGenreInput.value = (info.categories || [])[0] || '';
    const cover = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';
    bookCoverInput.value = cover;
    coverPreview.src = cover;
    isbnStatus.textContent = 'Данные найдены и подставлены в форму.';
  } catch (err) {
    console.error(err);
    isbnStatus.textContent = 'Ошибка запроса к Google Books API.';
  }
});

// ---------- Выдача / возврат книги ----------
function openLendModal(book) {
  lendBookIdInput.value = book.id;
  lendForm.reset();
  lendDateInput.value = new Date().toISOString().slice(0, 10);
  lendModal.classList.remove('hidden');
}

lendCancelBtn.addEventListener('click', () => lendModal.classList.add('hidden'));

lendForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = lendBookIdInput.value;
  try {
    await updateDoc(doc(db, 'users', currentUser.uid, 'books', id), {
      status: 'lent',
      borrower: lendBorrowerInput.value.trim(),
      lendDate: lendDateInput.value,
      dueDate: lendDueDateInput.value || ''
    });
    lendModal.classList.add('hidden');
    showToast('Книга отмечена как выданная');
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
