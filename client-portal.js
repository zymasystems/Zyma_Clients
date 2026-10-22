(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const API_BASE = String(window.ZYMA_PORTAL_CONFIG?.apiBaseUrl || 'https://api.zyma.co.za').replace(/\/$/, '');
  const state = { user: null, project: null, projects: [], updates: [], tickets: [] };
  const api = async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: { Accept: 'application/json', ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
      ...options
    });
    if (!response.ok) {
      let message = '';
      try { const payload = await response.json(); message = payload.message || payload.title || ''; } catch (_) {}
      const error = new Error(message || (response.status === 404 ? 'The portal API endpoint is not available yet.' : response.status === 401 ? 'Your session has expired. Please sign in again.' : 'The request could not be completed.'));
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const formatDate = value => {
    if (!value) return 'Not scheduled';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-ZA', { day:'2-digit', month:'short', year:'numeric' });
  };
  const message = text => {
    const host = $('#portal-toast');
    if (!host) return;
    host.textContent = text; host.classList.add('show');
    window.setTimeout(() => host.classList.remove('show'), 3500);
  };
  const setEmpty = (selector, text) => { const el = $(selector); if (el) el.innerHTML = `<div class="empty-state">${esc(text)}</div>`; };
  function hydrateUser(user) {
    state.user = user || {};
    const name = String(state.user.name || state.user.fullName || state.user.email || 'Client user');
    const company = String(state.user.organizationName || state.user.company || '');
    const initials = name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0].toUpperCase()).join('') || 'CL';
    $$('.portal-user .avatar, .top-actions .avatar').forEach(el => { el.textContent = initials; });
    const nameEl = $('.portal-user strong'); if (nameEl) nameEl.textContent = name;
    const roleEl = $('.portal-user small'); if (roleEl) roleEl.textContent = state.user.role === 'client_admin' ? 'Client administrator' : 'Client user';
    const welcome = $('.welcome-row h1'); if (welcome) welcome.textContent = `Welcome${name ? `, ${name.split(/\s+/)[0]}` : ''}`;
    const workspaceName = $('.client-workspace strong'); if (workspaceName) workspaceName.textContent = company || 'Client workspace';
    const workspaceIcon = $('.client-workspace .client-icon'); if (workspaceIcon) workspaceIcon.textContent = company ? company.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0].toUpperCase()).join('') : 'CL';
  }
  function showSection(name) {
    const section = $('#section-' + name); if (!section) return;
    $$('.portal-section').forEach(el => el.classList.toggle('active', el === section));
    $$('.portal-nav-item').forEach(el => el.classList.toggle('active', el.dataset.section === name));
    const labels = {overview:'Overview',application:'My application',updates:'Development updates',support:'Help & maintenance'};
    const breadcrumb = $('#current-breadcrumb'); if (breadcrumb) breadcrumb.textContent = labels[name] || 'Overview';
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function renderMilestones() {
    const project = state.project;
    const milestones = Array.isArray(project?.milestones) ? project.milestones : [];
    const markup = milestones.length ? milestones.map((m,i) => {
      const status = String(m.status || 'Upcoming');
      const done = ['done','completed','approved'].includes(status.toLowerCase());
      const current = ['in progress','in review','current'].includes(status.toLowerCase());
      return `<div class="roadmap-item ${done?'done':current?'current':'upcoming'}"><span class="roadmap-mark">${done?'✓':i+1}</span><div><strong>${esc(m.title || m.name || 'Milestone')}</strong><small>${esc(m.description || m.deliverable || '')}</small></div><span class="roadmap-status ${current?'in-progress':''}">${esc(status)}</span></div>`;
    }).join('') : '<div class="empty-state">No milestones have been published for this application yet.</div>';
    ['#overview-milestone-track','#full-milestone-track'].forEach(selector => { const el=$(selector); if(el) el.innerHTML=markup; });
    const completed = milestones.filter(m => ['done','completed','approved'].includes(String(m.status||'').toLowerCase())).length;
    const completedEl=$('#portal-milestones-completed'); if(completedEl) completedEl.textContent=String(completed);
    const note=$('#portal-milestones-note'); if(note) note.textContent=`${Math.max(0,milestones.length-completed)} remaining`;
  }
  function renderUpdates() {
    const filter = $('#update-filter')?.value || 'all';
    const visible = state.updates.filter(item => filter === 'all' || item.category === filter);
    const markup = visible.length ? visible.map(item => `<article class="update-item"><span class="update-dot ${item.category==='Approval'?'green-dot':item.category==='Milestone'?'blue-dot':'orange-dot'}"></span><div><div class="update-meta"><strong>${esc(item.title || item.subject || 'Project update')}</strong><time>${esc(formatDate(item.createdAt || item.date))}</time></div><p>${esc(item.body || item.message || '')}</p><span class="update-tag">${esc(item.category || 'Development')}</span></div></article>`).join('') : '<div class="empty-state">No project updates have been published.</div>';
    ['#overview-update-feed','#full-update-feed'].forEach(selector => { const el=$(selector); if(el) el.innerHTML=markup; });
  }
  function renderTickets() {
    const tickets = state.tickets;
    const openStatus = status => !['Resolved','Closed'].includes(String(status));
    const open = tickets.filter(t => openStatus(t.status)).length;
    const resolved = tickets.length-open;
    [['#nav-ticket-count',open],['#open-ticket-stat',open],['#all-ticket-count',tickets.length],['#open-ticket-count',open],['#resolved-ticket-count',resolved]].forEach(([sel,val])=>{const el=$(sel);if(el)el.textContent=String(val);});
    const note=$('#support-stat-note'); if(note) note.textContent=open?`${open} open request${open===1?'':'s'}`:'No open requests';
    const statusClass = status => ['Resolved','Closed'].includes(status)?'status-resolved':status==='In progress'?'status-progress':'status-open';
    const render = t => `<article class="ticket-row"><span class="ticket-symbol">${String(t.type||'').toLowerCase().includes('error')?'!':String(t.type||'').toLowerCase().includes('maintenance')?'⚙':'?'}</span><div class="ticket-main"><strong>${esc(t.subject)}</strong><div class="ticket-meta"><span>${esc(t.reference || t.id || 'Request')}</span><span>${esc(formatDate(t.createdAt || t.created))}</span><span>${esc(t.type || 'Support')}</span></div>${t.response || t.reply ? `<p class="ticket-reply">${esc(t.response || t.reply)}</p>`:''}</div><div class="ticket-right"><span class="status-chip ${statusClass(t.status)}">${esc(t.status || 'Open')}</span><span class="priority-chip">${esc(t.priority || 'Normal')} priority</span></div></article>`;
    const recent = $('#overview-ticket-list'); if(recent) recent.innerHTML=tickets.length?tickets.slice().reverse().slice(0,2).map(render).join(''):'<div class="empty-state">No support requests have been submitted.</div>';
    const filter=$('#ticket-filter')?.value||'all';
    const filtered=tickets.slice().reverse().filter(t=>filter==='all'||(filter==='open'?openStatus(t.status):!openStatus(t.status)));
    const list=$('#full-ticket-list'); if(list) list.innerHTML=filtered.length?filtered.map(render).join(''):'<div class="empty-state">No requests match this filter.</div>';
  }
  function renderProject(project) {
    state.project = project || null;
    const p = state.project;
    const name = p?.name || p?.title || 'No application assigned';
    const code = p?.code || p?.reference || 'Not assigned';
    const lead = p?.managerName || p?.projectLead || p?.manager || 'Not assigned';
    const progress = Math.max(0, Math.min(100, Number(p?.progress) || 0));
    const setText=(selector,value)=>{const el=$(selector);if(el)el.textContent=String(value);};
    setText('.project-banner h2',name);
    setText('#portal-project-code',code); setText('#portal-project-lead',lead); setText('#portal-target-date',formatDate(p?.targetDate || p?.dueDate || p?.due));
    setText('#portal-progress-ring',p?`${progress}%`:'—'); setText('#portal-progress-stat',p?`${progress}%`:'—');
    setText('#portal-progress-note',p?'Current recorded progress.':'Progress appears when a project is linked.');
    const bar=$('#portal-progress-bar'); if(bar)bar.style.width=`${p?progress:0}%`;
    const ring=$('.progress-ring'); if(ring)ring.setAttribute('aria-label',p?`Development progress ${progress} percent`:'No application assigned');
    setText('#portal-build-status',p?.buildStatus || p?.status || 'Not available');
    const updateStatus = $('#portal-update-status'); if (updateStatus) updateStatus.innerHTML = `<i></i> ${esc(state.updates.length ? `Updated ${formatDate(state.updates[0].createdAt || state.updates[0].date)}` : 'No project updates yet')}`;
    setText('#portal-build-updated',p?.updatedAt?`Updated ${formatDate(p.updatedAt)}`:'No build update has been published.');
    setText('#portal-detail-name',name); setText('#portal-detail-code',code);
    setText('#portal-detail-start',formatDate(p?.startDate)); setText('#portal-detail-due',formatDate(p?.targetDate || p?.dueDate || p?.due));
    setText('#portal-detail-lead',lead); setText('#portal-detail-phase',p?.phase || p?.status || 'Not available');
    const status=$('#portal-project-status'); if(status)status.textContent=p?.status || 'No project linked';
    const scope=$('#portal-scope-list');
    if(scope) scope.innerHTML = p && Array.isArray(p.scopeItems) && p.scopeItems.length ? p.scopeItems.map(item=>`<li>${esc(typeof item==='string'?item:item.title||item.description||'')}</li>`).join('') : `<li>${p?.scope?esc(p.scope):'Project scope has not been published.'}</li>`;
    const emptyNote=!p;
    if(emptyNote) {
      ['#overview-milestone-track','#full-milestone-track'].forEach(sel=>setEmpty(sel,'No application is linked to this client account yet.'));
      setEmpty('#overview-update-feed','No application is linked to this client account yet.');
      setEmpty('#full-update-feed','No application is linked to this client account yet.');
    }
  }
  async function loadProjectDetails(projectId) {
    state.project = state.projects.find(project => String(project.id) === String(projectId)) || null;
    state.updates = [];
    if (state.project && projectId && !Array.isArray(state.project.milestones)) {
      const milestoneResult = await api(`/api/portal/projects/${encodeURIComponent(projectId)}/milestones`).catch(()=>({milestones:[]}));
      state.project.milestones = Array.isArray(milestoneResult) ? milestoneResult : (milestoneResult.milestones || milestoneResult.items || []);
    }
    if (state.project && projectId) {
      const updatesResult = await api(`/api/portal/updates?projectId=${encodeURIComponent(projectId)}`).catch(()=>({updates:[]}));
      state.updates = Array.isArray(updatesResult) ? updatesResult : (updatesResult.updates || updatesResult.items || []);
    }
    renderProject(state.project);
    renderMilestones(); renderUpdates();
  }
  async function loadPortal() {
    try {
      const auth = await api('/api/auth/me');
      const user = auth?.user || auth;
      if (!user || !String(user.role||'').toLowerCase().startsWith('client')) { window.location.replace('client-login.html'); return; }
      hydrateUser(user);
      const [projectResult, ticketResult] = await Promise.all([
        api('/api/portal/projects').catch(()=>({projects:[]})),
        api('/api/support/tickets').catch(()=>({tickets:[]}))
      ]);
      state.projects = Array.isArray(projectResult) ? projectResult : (projectResult.projects || projectResult.items || []);
      state.tickets = Array.isArray(ticketResult) ? ticketResult : (ticketResult.tickets || ticketResult.items || []);
      const selectorWrap = $('#project-selector-wrap');
      const selector = $('#portal-project-selector');
      if (selector && selectorWrap) {
        selector.innerHTML = state.projects.map(project => `<option value="${esc(project.id)}">${esc(project.name || project.title || project.code || 'Application')}</option>`).join('');
        selectorWrap.hidden = state.projects.length < 2;
        selector.addEventListener('change', () => loadProjectDetails(selector.value).catch(() => message('The selected application could not be loaded.')));
      }
      if (state.projects.length) await loadProjectDetails(state.projects[0].id);
      else { renderProject(null); renderMilestones(); renderUpdates(); }
      renderTickets();
    } catch (error) {
      if (error.status === 401) { window.location.replace('client-login.html'); return; }
      renderProject(null); renderMilestones(); renderUpdates(); renderTickets();
      message('Portal data could not be loaded. The shared API must be available before client data can be displayed.');
    }
  }
  let toastTimer;
  function openModal() { $('#request-feedback').textContent=''; $('#request-modal').hidden=false; document.body.classList.add('modal-open'); setTimeout(()=>$('#request-form select[name="type"]').focus(),30); }
  function closeModal() { $('#request-modal').hidden=true; document.body.classList.remove('modal-open'); }
  $$('.portal-nav-item').forEach(button=>button.addEventListener('click',()=>showSection(button.dataset.section)));
  $$('[data-go]').forEach(button=>button.addEventListener('click',()=>showSection(button.dataset.go)));
  $$('[data-open-request]').forEach(button=>button.addEventListener('click',openModal));
  $('#close-request')?.addEventListener('click',closeModal); $('#cancel-request')?.addEventListener('click',closeModal);
  $('#request-modal')?.addEventListener('click',e=>{if(e.target===$('#request-modal'))closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#request-modal')&&!$('#request-modal').hidden)closeModal();});
  $('#ticket-filter')?.addEventListener('change',renderTickets); $('#update-filter')?.addEventListener('change',renderUpdates);
  $('#request-form')?.addEventListener('submit', async e=>{
    e.preventDefault();
    const form=e.currentTarget;
    if(!form.reportValidity()) return;
    const submit=form.querySelector('[type="submit"]'); const data=new FormData(form);
    submit.disabled=true; setTextForRequest('Submitting…');
    try {
      const response=await fetch(`${API_BASE}/api/support/tickets`,{method:'POST',credentials:'include',headers:{Accept:'application/json'},body:data});
      if(!response.ok) throw new Error(response.status===404?'Support requests are not connected yet. Please contact Zyma Systems directly.':'Your request could not be submitted. Please try again.');
      const created=await response.json();
      state.tickets.push(created.ticket || created);
      renderTickets(); form.reset(); closeModal(); showSection('support'); message(`Support request ${created.reference || created.id || ''} submitted.`);
    } catch(error) { $('#request-feedback').textContent=error.message || 'Support request could not be submitted.'; }
    finally { submit.disabled=false; setTextForRequest('Submit request'); }
  });
  function setTextForRequest(text){const submit=$('#request-form [type="submit"]');if(submit)submit.textContent=text;}
  $('#client-menu')?.addEventListener('click',async()=>{
    try { await api('/api/auth/logout',{method:'POST'}); } catch (_) {}
    window.location.href='client-login.html';
  });
  loadPortal();
})();