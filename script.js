const cfg = window.APP_CONFIG || {};
const ready = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR_');
const sb = ready ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
const page = location.pathname.split('/').pop() || 'index.html';
const LABELS = { love:'Love Poem', life:'Life Story', heartbreak:'Heartbreak Poem', blog:'Blog' };
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);
const SETUP_MSG = '<div class="msg">Backend not set up yet — add your Supabase URL and key in <b>config.js</b>.</div>';

const card = p => `<a class="card" href="posts.html?id=${p.id}"><span class="tag">${LABELS[p.category]||p.category}</span><h3>${esc(p.title)}</h3><p>${esc(p.body.slice(0,90))}…</p></a>`;
const EMPTY = '<p class="empty" style="grid-column:1/-1">No writings published yet. Check back soon.</p>';

async function fetchPosts() {
  if (!sb) return { posts: [], error: 'config' };
  const { data, error } = await sb.from('posts').select('*').order('created_at', { ascending:false });
  return { posts: data || [], error };
}

async function init() {
  let user = null, admin = false;
  if (sb) {
    const { data } = await sb.auth.getSession();
    user = data.session?.user || null;
    if (user) {
      const r = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
      admin = !!r.data;
    }
  }

  $('site-header').innerHTML = `<div class="wrap"><a class="logo" href="index.html">Lizzie Makanja</a><nav id="nav">
    <a href="index.html" class="${page==='index.html'?'active':''}">Home</a>
    <a href="posts.html" class="${page==='posts.html'?'active':''}">Writings</a>
    <a href="about.html" class="${page==='about.html'?'active':''}">About</a>
    <a href="login.html" id="auth-link">${user?'Sign out':'Sign in'}</a></nav>
    <button class="burger" id="burger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button></div>`;
  $('burger').addEventListener('click', () => {
    const open = $('nav').classList.toggle('open');
    $('burger').classList.toggle('open', open);
    $('burger').setAttribute('aria-expanded', open);
  });
  $('nav').addEventListener('click', e => { if (e.target.tagName === 'A') { $('nav').classList.remove('open'); $('burger').classList.remove('open'); } });
  $('site-footer').innerHTML = `<div class="wrap"><span class="logo">Writing heals me, makes me happy and nourishes me.</span>© ${new Date().getFullYear()} Lizzie Makanja. All rights reserved.</div>`;
  $('auth-link').addEventListener('click', async e => {
    if (user) { e.preventDefault(); await sb.auth.signOut(); location.href = 'index.html'; }
  });

  // Home: latest
  const latest = $('latest');
  if (latest) {
    if (!sb) { latest.innerHTML = SETUP_MSG; }
    else { const { posts } = await fetchPosts();
      latest.innerHTML = posts.length ? posts.slice(0,3).map(card).join('') : EMPTY; }
  }

  // Writings
  const list = $('post-list');
  if (list) {
    const q = new URLSearchParams(location.search);
    const id = q.get('id');
    if (!sb) { list.innerHTML = SETUP_MSG; }
    else if (id) {
      $('filters')?.remove();
      const { data: p } = await sb.from('posts').select('*').eq('id', id).maybeSingle();
      list.className = '';
      list.innerHTML = p
        ? `<p class="tag">${LABELS[p.category]}</p><h1>${esc(p.title)}</h1>
           <p class="post" style="margin:20px 0">${esc(p.body)}</p>
           <a class="btn" href="posts.html">← All writings</a>
           ${admin ? '<button class="btn danger" id="del">Delete</button>' : ''}`
        : '<p class="empty">Writing not found.</p>';
      $('del')?.addEventListener('click', async () => {
        if (!confirm('Delete this writing?')) return;
        await sb.from('posts').delete().eq('id', id);
        location.href = 'posts.html';
      });
    } else {
      let f = q.get('category') || (q.get('type') === 'blog' ? 'blog' : 'all');
      const { posts } = await fetchPosts();
      const draw = () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.f === f));
        const l = posts.filter(p => f === 'all' || p.category === f);
        list.innerHTML = l.length ? l.map(card).join('') : EMPTY;
      };
      document.querySelectorAll('.chip').forEach(c => c.onclick = () => { f = c.dataset.f; draw(); });
      draw();
    }
    const form = $('new-post');
    if (form && admin && !id) {
      form.style.display = 'flex';
      form.onsubmit = async e => {
        e.preventDefault();
        const d = new FormData(form);
        const { error } = await sb.from('posts').insert({ title: d.get('title'), category: d.get('cat'), body: d.get('body') });
        if (error) return alert(error.message);
        location.href = 'posts.html';
      };
    }
  }

  // Login / sign up
  const login = $('login-form');
  if (login) {
    if (!sb) { $('auth-msg').innerHTML = SETUP_MSG; return; }
    let mode = 'in';
    const msg = t => $('auth-msg').innerHTML = `<div class="msg">${esc(t)}</div>`;
    $('toggle-mode').onclick = () => {
      mode = mode === 'in' ? 'up' : 'in';
      $('auth-title').textContent = mode === 'in' ? 'Sign in' : 'Create account';
      $('auth-submit').textContent = mode === 'in' ? 'Sign in' : 'Sign up';
      $('toggle-mode').textContent = mode === 'in' ? 'No account? Sign up' : 'Have an account? Sign in';
    };
    login.onsubmit = async e => {
      e.preventDefault();
      const email = $('email').value, password = $('password').value;
      const res = mode === 'in'
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password });
      if (res.error) return msg(res.error.message);
      if (mode === 'up' && !res.data.session) return msg('Check your email to confirm your account, then sign in.');
      location.href = 'posts.html';
    };
    $('google-btn').onclick = async () => {
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google',
        options: { redirectTo: new URL('posts.html', location.href).href } });
      if (error) msg(error.message);
    };
  }
}
init();
