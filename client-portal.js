(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const API_BASE = String(window.ZYMA_PORTAL_CONFIG?.apiBaseUrl || 'https://api.zyma.co.za/api/crm').replace(/\/$/, '');
  const state = { user: null, project: null, projects: [], tasks: [], updates: [], tickets: [], updatesError: false, updatesLoading: false, milestonesError: false, tasksError: false, updateTimer: null };
  const api = async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: 'omit',
      headers: { Accept: 'application/json', ...(sessionStorage.getItem('zyma_portal_access_token') ? { Authorization: `Bearer ${sessionStorage.getItem('zyma_portal_access_token')}` } : {}), ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
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
    const company = String(state.user.companyName || state.user.organizationName || state.user.company || '');
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
    const markup = state.milestonesError
      ? '<div class="empty-state">Milestones could not be loaded. Please refresh the portal or contact Zyma support.</div>'
      : milestones.length ? milestones.map((m,i) => {
      const status = String(m.status || 'Upcoming');
      const done = ['done','completed','approved'].includes(status.toLowerCase());
      const current = ['in progress','in review','current'].includes(status.toLowerCase());
      const targetDate = m.targetDateUtc || m.targetDate || m.dueDateUtc;
      const details = [m.description || m.deliverable || '', targetDate ? `Target: ${formatDate(targetDate)}` : ''].filter(Boolean).join(' · ');
      return `<article class="roadmap-item ${done?'done':current?'current':'upcoming'}"><div class="roadmap-card"><span class="roadmap-phase">${done?'STAGE COMPLETE':current?'CURRENT STAGE':`STAGE ${String(i+1).padStart(2,'0')}`}</span><strong>${esc(m.title || m.name || 'Milestone')}</strong><small>${esc(details || 'Milestone details will be published by your project team.')}</small><span class="roadmap-status ${current?'in-progress':''}">${esc(status)}</span></div><span class="roadmap-mark">${done?'✓':i+1}</span></article>`;
    }).join('') : '<div class="empty-state">No milestones have been approved for client viewing yet.</div>';
    ['#overview-milestone-track','#full-milestone-track'].forEach(selector => { const el=$(selector); if(el) el.innerHTML=markup; });
    const completed = milestones.filter(m => ['done','completed','approved'].includes(String(m.status||'').toLowerCase())).length;
    const completedEl=$('#portal-milestones-completed'); if(completedEl) completedEl.textContent=String(completed);
    const note=$('#portal-milestones-note'); if(note) note.textContent=`${Math.max(0,milestones.length-completed)} remaining`;
  }
  function renderUpdates() {
    const filter = $('#update-filter')?.value || 'all';
    const visible = state.updates.filter(item => filter === 'all' || String(item.category || 'Development').toLowerCase() === filter.toLowerCase());
    const markup = visible.length ? visible.map(item => { const category = String(item.category || 'Development'); const dot = category.toLowerCase() === 'approval' ? 'green-dot' : category.toLowerCase() === 'milestone' ? 'blue-dot' : 'orange-dot'; return `<article class="update-item"><span class="update-dot ${dot}"></span><div><div class="update-meta"><strong>${esc(item.title || item.subject || 'Project update')}</strong><time>${esc(formatDate(item.publishedAtUtc || item.publishedAt || item.createdAt || item.createdAtUtc || item.date))}</time></div><p>${esc(item.body || item.message || item.description || '')}</p><span class="update-tag">${esc(category)}</span></div></article>`; }).join('') : `<div class="empty-state">${state.updatesError ? 'Development updates are temporarily unavailable. Please try again shortly.' : state.updatesLoading ? 'Loading published updates…' : 'No project updates have been published.'}</div>`;
    ['#overview-update-feed','#full-update-feed'].forEach(selector => { const el=$(selector); if(el) el.innerHTML=markup; });
  }
  function renderTickets() {
    const tickets = state.tickets;
    const openStatus = status => !['Resolved','Closed'].includes(String(status));
    const open = tickets.filter(t => openStatus(t.status)).length;
    const resolved = tickets.length-open;
    [['#nav-ticket-count',open],['#open-ticket-stat',open],['#all-ticket-count',tickets.length],['#open-ticket-count',open],['#resolved-ticket-count',resolved]].forEach(([sel,val])=>{const el=$(sel);if(el)el.textContent=String(val);});
    const note=$('#support-stat-note'); if(note) note.textContent=open?`${open} open request${open===1?'':'s'}`:'No open requests';
    const statusClass = status => ['Resolved','Closed'].includes(status)?'status-resolved':['InProgress','In progress','AwaitingClient'].includes(status)?'status-progress':'status-open';
    const render = t => `<article class="ticket-row"><span class="ticket-symbol">${String(t.category||t.type||'').toLowerCase().includes('error')?'!':String(t.category||t.type||'').toLowerCase().includes('maintenance')?'⚙':'?'}</span><div class="ticket-main"><strong>${esc(t.subject)}</strong><div class="ticket-meta"><span>${esc(t.ticketReference || t.reference || t.id || 'Request')}</span><span>${esc(formatDate(t.createdAtUtc || t.createdAt || t.created))}</span><span>${esc(t.category || t.type || 'General')}</span></div>${t.lastReply || t.response || t.reply ? `<p class="ticket-reply">${esc(t.lastReply || t.response || t.reply)}</p>`:''}</div><div class="ticket-right"><span class="status-chip ${statusClass(t.status)}">${esc(({InProgress:'In progress',AwaitingClient:'Awaiting client'}[t.status] || t.status || 'Open'))}</span><span class="priority-chip">${esc(t.priority || 'Normal')} priority</span><button class="outline-button ticket-view-button" type="button" data-view-ticket="${esc(t.id)}">View</button></div></article>`;
    const recent = $('#overview-ticket-list'); if(recent) recent.innerHTML=tickets.length?tickets.slice().reverse().slice(0,2).map(render).join(''):'<div class="empty-state">No support requests have been submitted.</div>';
    const filter=$('#ticket-filter')?.value||'all';
    const filtered=tickets.slice().reverse().filter(t=>filter==='all'||(filter==='open'?openStatus(t.status):!openStatus(t.status)));
    const list=$('#full-ticket-list'); if(list) list.innerHTML=filtered.length?filtered.map(render).join(''):'<div class="empty-state">No requests match this filter.</div>';
  }
  function renderProject(project) {
    state.project = project || null;
    loadClientLogo();
    const p = state.project;
    const firstValue = (...values) => values.find(value =>
      value !== undefined && value !== null && String(value).trim() !== ''
    );
    const name = firstValue(p?.name, p?.Name, p?.title, p?.Title, 'No application assigned');
    // The CRM and portal API have used different DTO field names over time.
    // Accept the known project-reference aliases instead of silently showing
    // "Not assigned" when the API returns ProjectReference/ProjectCode.
    const code = firstValue(
      p?.code, p?.Code, p?.projectCode, p?.ProjectCode,
      p?.projectReference, p?.ProjectReference,
      p?.referenceCode, p?.ReferenceCode, p?.reference, p?.Reference,
      'Not assigned'
    );
    const leadValue = firstValue(
      p?.managerName, p?.ManagerName, p?.projectLead, p?.ProjectLead,
      p?.projectLeadName, p?.ProjectLeadName, p?.projectManagerName,
      p?.ProjectManagerName, p?.manager, p?.Manager,
      p?.assignedToName, p?.AssignedToName, p?.ownerName, p?.OwnerName
    );
    const lead = typeof leadValue === 'object' && leadValue
      ? firstValue(leadValue.fullName, leadValue.name, leadValue.displayName, leadValue.email, 'Not assigned')
      : firstValue(leadValue, 'Not assigned');
    const scopeText = firstValue(
      p?.scope, p?.Scope, p?.agreedScope, p?.AgreedScope,
      p?.projectScope, p?.ProjectScope, p?.description, p?.Description,
      p?.scopeDescription, p?.ScopeDescription
    );
    const scopeItems = firstValue(p?.scopeItems, p?.ScopeItems, p?.deliverables, p?.Deliverables);
    const rawMilestones = Array.isArray(p?.milestones) ? p.milestones : [];
    const completedMilestones = rawMilestones.filter(m => ['done','completed','approved'].includes(String(m.status || '').toLowerCase())).length;
    const apiProgress = p?.progressPercentage ?? p?.ProgressPercentage ?? p?.progress ?? p?.completionPercentage;
    const progress = Math.max(0, Math.min(100, apiProgress !== undefined && apiProgress !== null && apiProgress !== '' ? Number(apiProgress) || 0 : (rawMilestones.length ? Math.round(completedMilestones * 100 / rawMilestones.length) : 0)));
    const setText=(selector,value)=>{const el=$(selector);if(el)el.textContent=String(value);};
    setText('.project-banner h2',name);
    setText('#portal-project-code',code); setText('#portal-project-lead',lead); setText('#portal-target-date',formatDate(p?.targetDate || p?.targetEndDateUtc || p?.dueDate || p?.due));
    setText('#portal-progress-ring',p?`${progress}%`:'—'); setText('#portal-progress-stat',p?`${progress}%`:'—');
    setText('#portal-progress-note',p?'Current recorded progress.':'Progress appears when a project is linked.');
    const bar=$('#portal-progress-bar'); if(bar)bar.style.width=`${p?progress:0}%`;
    const ring=$('.progress-ring'); if(ring){ring.style.setProperty('--progress',`${p?progress:0}%`);ring.setAttribute('aria-label',p?`Development progress ${progress} percent`:'No application assigned');}
    setText('#portal-build-status',p?.buildStatus || p?.status || 'Not available');
    const updateStatus = $('#portal-update-status'); if (updateStatus) updateStatus.innerHTML = `<i></i> ${esc(state.updates.length ? `Updated ${formatDate(state.updates[0].publishedAtUtc || state.updates[0].publishedAt || state.updates[0].createdAt || state.updates[0].date)}` : 'No project updates yet')}`;
    setText('#portal-build-updated',p?.updatedAt?`Updated ${formatDate(p.updatedAt)}`:'No build update has been published.');
    setText('#portal-detail-name',name); setText('#portal-detail-code',code);
    setText('#company-identity-subtitle', p?.clientName || p?.companyName || 'Your Zyma Systems project workspace');
    setText('#company-reference-tag', `REF · ${code}`);
    setText('#company-profile-status', p?.status || p?.phase || 'Planning');
    setText('#portal-detail-start',formatDate(p?.startDate || p?.startDateUtc)); setText('#portal-detail-due',formatDate(p?.targetDate || p?.targetEndDateUtc || p?.dueDate || p?.due));
    setText('#portal-detail-lead',lead); setText('#portal-detail-phase',p?.phase || p?.status || 'Not available');
    const status=$('#portal-project-status'); if(status)status.textContent=p?.status || 'No project linked';
    const scope=$('#portal-scope-list');
    const publishedScopeItems = Array.isArray(scopeItems) ? scopeItems : [];
    if(scope) scope.innerHTML = p && publishedScopeItems.length
      ? publishedScopeItems.map(item=>`<li>${esc(typeof item==='string'?item:item.title||item.Title||item.description||item.Description||'')}</li>`).join('')
      : `<li>${p && scopeText ? esc(scopeText) : 'Project scope has not been published.'}</li>`;
    const emptyNote=!p;
    if(emptyNote) {
      ['#overview-milestone-track','#full-milestone-track'].forEach(sel=>setEmpty(sel,'No application is linked to this client account yet.'));
      setEmpty('#overview-update-feed','No application is linked to this client account yet.');
      setEmpty('#full-update-feed','No application is linked to this client account yet.');
    }
  }
  function renderTasks() {
    const host = $('#portal-task-list');
    const summary = $('#portal-task-summary');
    if (!host) return;
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const isDone = task => ['completed','complete','done','closed'].includes(String(task.status || '').toLowerCase());
    const completed = tasks.filter(isDone);
    const active = tasks.filter(task => !isDone(task));
    if (summary) summary.textContent = `${completed.length} filed · ${active.length} on the board`;
    if (state.tasksError) {
      host.innerHTML = '<div class="empty-state">Development tasks are temporarily unavailable. Please try again shortly.</div>';
      return;
    }
    if (!tasks.length) {
      host.innerHTML = '<div class="empty-state board-empty"><span class="empty-board-icon">▤</span><strong>Your pinboard is ready</strong><p>Tasks will appear here as your project team publishes them.</p></div>';
      return;
    }
    const cssStatus = status => String(status || 'To Do').toLowerCase().replace(/[^a-z]+/g,'-').replace(/^-|-$/g,'');
    const taskIcons = ['⌘','✎','⌁','◇','▤','⚙','⌕','↗','◈','✦','▣','◎','⌬','◉','⊞','✧'];
    const iconForTask = (task, index) => {
      const text = `${task.title || ''} ${task.description || ''}`.toLowerCase();
      const rules = [
        [/design|wireframe|mockup|visual|brand|style/, '✎'],
        [/test|qa|quality|browser|performance|bug/, '✓'],
        [/deploy|launch|release|publish|hosting/, '↗'],
        [/database|data|sql|api|backend|server/, '▤'],
        [/security|auth|login|password|permission/, '◈'],
        [/responsive|mobile|layout|css|interface|ui/, '▦'],
        [/content|copy|image|portfolio|page/, '▧'],
        [/repository|git|branch|version|commit/, '⌘'],
        [/contact|form|email|message|support/, '✉'],
        [/meeting|review|feedback|approval/, '◎'],
        [/document|scope|requirement|specification/, '≡'],
        [/integrat|connect|webhook|automation/, '⌁']
      ];
      const match = rules.find(([pattern]) => pattern.test(text));
      return match ? match[1] : taskIcons[index % taskIcons.length];
    };
    const card = (task, index, done=false) => {
      const status = String(task.status || (done ? 'Completed' : 'To Do'));
      const css = cssStatus(status);
      const due = task.dueDateUtc || task.dueDate ? `Due ${formatDate(task.dueDateUtc || task.dueDate)}` : '';
      const completedDate = task.completedAtUtc || task.completedAt || task.updatedAtUtc;
      const meta = done ? `Filed${completedDate ? ` ${formatDate(completedDate)}` : ''}` : (due || 'In the development queue');
      const icon = done ? '✓' : iconForTask(task, index);
      return `<article class="task-pin ${done ? 'task-pin-completed' : ''} pin-variation-${index % 4}"><span class="task-pin-head" aria-hidden="true"></span><div class="task-pin-topline"><span class="task-pin-category">${done ? 'COMPLETED FILE' : 'DEVELOPMENT TASK'}</span><span class="task-pin-icon" aria-hidden="true">${icon}</span></div><h3>${esc(task.title || 'Development task')}</h3>${task.description ? `<p>${esc(task.description)}</p>` : '<p class="task-no-description">A task tracked by your Zyma project team.</p>'}<div class="task-pin-footer"><span class="portal-task-badge ${esc(css)}">${esc(status)}</span><small>${esc(meta)}</small></div></article>`;
    };
    const activeMarkup = active.length ? `<div class="pinboard-grid">${active.map((task,i)=>card(task,i)).join('')}</div>` : '<div class="empty-state board-empty compact-empty">Nothing currently pinned. Your active task board is clear.</div>';
    const completedMarkup = completed.length ? `<details class="completed-file"><summary><span class="file-folder-icon" aria-hidden="true">▰</span><span class="completed-file-copy"><strong>Completed</strong><small>${completed.length} task${completed.length===1?'':'s'} filed away</small></span><span class="completed-file-action">Open file <span aria-hidden="true">⌄</span></span></summary><div class="pinboard-grid completed-pinboard">${completed.map((task,i)=>card(task,i,true)).join('')}</div></details>` : `<div class="completed-file empty-file"><span class="file-folder-icon" aria-hidden="true">▱</span><span class="completed-file-copy"><strong>Completed</strong><small>Finished tasks will be filed here automatically.</small></span></div>`;
    host.innerHTML = `<section class="active-pinboard"><div class="pinboard-section-heading"><div><span class="pinboard-overline">IN PROGRESS</span><h3>On the board</h3></div><span class="pin-count">${active.length} pinned</span></div>${activeMarkup}</section>${completedMarkup}`;
  }
  async function loadProjectTasks(projectId, { silent = false } = {}) {
    if (!projectId) {
      state.tasks = [];
      state.tasksError = false;
      renderTasks();
      return;
    }
    try {
      const result = await api(`/portal/projects/${encodeURIComponent(projectId)}/tasks`);
      state.tasks = Array.isArray(result) ? result : (result?.tasks || result?.items || []);
      state.tasksError = false;
    } catch (error) {
      state.tasksError = true;
      if (!silent) {
        if (error.status === 401) { window.location.replace('client-login.html'); return; }
        message(error.message || 'Could not load development tasks.');
      }
    }
    renderTasks();
  }
  async function loadProjectUpdates(projectId, { silent = false } = {}) {
    if (!projectId) {
      state.updates = [];
      state.updatesError = false;
      state.updatesLoading = false;
      renderUpdates();
      return;
    }
    if (!silent) {
      state.updatesLoading = true;
      state.updatesError = false;
      renderUpdates();
    }
    try {
      // Requires the protected API endpoint: GET /portal/updates?projectId={id}.
      // The API must derive client scope from the authenticated user, not trust a client ID.
      const result = await api(`/portal/updates?projectId=${encodeURIComponent(projectId)}`);
      const items = Array.isArray(result) ? result : (result?.updates || result?.items || []);
      state.updates = items.slice().sort((a, b) => {
        const dateA = new Date(a.publishedAtUtc || a.publishedAt || a.createdAt || a.createdAtUtc || a.date || 0).getTime() || 0;
        const dateB = new Date(b.publishedAtUtc || b.publishedAt || b.createdAt || b.createdAtUtc || b.date || 0).getTime() || 0;
        return dateB - dateA;
      });
      state.updatesError = false;
    } catch (error) {
      state.updatesError = true;
      // Keep the last successful response during transient failures.
      if (!silent && error.status === 404) {
        console.warn('The API endpoint GET /portal/updates is not deployed yet.');
      } else if (!silent) {
        message(error.message || 'Could not load development updates.');
      }
    } finally {
      state.updatesLoading = false;
      renderUpdates();
      const updateStatus = $('#portal-update-status');
      if (updateStatus) updateStatus.innerHTML = `<i></i> ${esc(state.updates.length ? `Updated ${formatDate(state.updates[0].publishedAtUtc || state.updates[0].publishedAt || state.updates[0].createdAt || state.updates[0].createdAtUtc || state.updates[0].date)}` : state.updatesError ? 'Updates unavailable' : 'No project updates yet')}`;
      if (state.project) {
        const buildUpdate = $('#portal-build-updated');
        if (buildUpdate && state.updates.length) buildUpdate.textContent = `Updated ${formatDate(state.updates[0].publishedAtUtc || state.updates[0].publishedAt || state.updates[0].createdAt || state.updates[0].createdAtUtc || state.updates[0].date)}`;
      }
    }
  }

  async function loadProjectDetails(projectId) {
    state.project = state.projects.find(project => String(project.id) === String(projectId)) || null;
    state.updates = [];
    state.milestonesError = false;
    if (state.project && projectId) {
      try {
        const milestoneResult = await api(`/portal/projects/${encodeURIComponent(projectId)}/milestones`);
        state.project.milestones = Array.isArray(milestoneResult) ? milestoneResult : (milestoneResult.milestones || milestoneResult.items || []);
      } catch (error) {
        state.milestonesError = true;
        state.project.milestones = [];
        if (error.status === 401) { window.location.replace('client-login.html'); return; }
        console.error('Could not load client-visible project milestones:', error);
      }
    }
    await Promise.all([loadProjectTasks(projectId, { silent: true }), loadProjectUpdates(projectId)]);
    // Refresh the selected project's summary from the API so task progress stays current.
    if (projectId) {
      const latest = await api(`/portal/projects/${encodeURIComponent(projectId)}`).catch(()=>null);
      if (latest) {
        const detail = latest.project || latest;
        state.project = { ...state.project, ...detail, milestones: state.project?.milestones || [] };
        state.projects = state.projects.map(item => String(item.id) === String(projectId) ? { ...item, ...detail } : item);
      }
    }
    renderProject(state.project);
    renderMilestones(); renderTasks(); renderUpdates();
  }
  async function loadPortal() {
    try {
      // /portal/me is protected by [Authorize(Roles = "Client")]. A successful
      // response is therefore the authorization check; its current payload
      // does not include a role field.
      const auth = await api('/portal/me');
      const user = auth?.user || auth;
      if (!user || !(user.id || user.email || user.fullName)) {
        throw new Error('The portal API returned an invalid client profile.');
      }
      hydrateUser(user);
      const projectResult = await api('/portal/projects');
      state.projects = Array.isArray(projectResult) ? projectResult : (projectResult.projects || projectResult.items || []);
      await loadSupportTickets({ silent: true });
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

  const profileModal = $('#profile-modal');
  const profileForm = $('#profile-form');
  const profileFeedback = $('#profile-feedback');
  const profileFields = ['fullName','jobTitle','department','companyRole','email','alternateEmail','phone','mobile','preferredContact','linkedin','companyName','industry','companyWebsite','companyEmail','companyPhone','companySize','registrationNumber','vatNumber','address','city','province','postalCode','country'];
  const profileAliases = {
    fullName:['fullName','name','contactName'], jobTitle:['jobTitle'], department:['department'], companyRole:['companyRole'],
    email:['email'], alternateEmail:['alternateEmail'], phone:['phone'], mobile:['mobile'], preferredContact:['preferredContact'], linkedin:['linkedin','linkedIn'],
    companyName:['companyName','organizationName','company','clientName'], industry:['industry'], companyWebsite:['companyWebsite','website'],
    companyEmail:['companyEmail'], companyPhone:['companyPhone'], companySize:['companySize'], registrationNumber:['registrationNumber'],
    vatNumber:['vatNumber'], address:['address','streetAddress'], city:['city'], province:['province','state'], postalCode:['postalCode'], country:['country']
  };
  const profileValue = (user, field) => {
    const sources = [user, user?.contact, user?.clientContact, user?.client, user?.company, user?.organization];
    for (const source of sources) for (const key of (profileAliases[field] || [field])) if (source?.[key] !== undefined && source?.[key] !== null) return source[key];
    return '';
  };
  function openProfile() {
    if (!profileModal || !profileForm) return;
    const user = state.user || {};
    profileFields.forEach(field => { const input = profileForm.elements.namedItem(field); if (input) input.value = String(profileValue(user, field) ?? ''); });
    if (profileFeedback) { profileFeedback.textContent = ''; profileFeedback.className = 'form-feedback'; }
    profileModal.hidden = false;
    document.body.classList.add('modal-open');
    $('#profile-form input[name="fullName"]')?.focus();
  }
  function closeProfile() { if (profileModal) profileModal.hidden = true; document.body.classList.remove('modal-open'); }
  $('#client-menu')?.addEventListener('click', openProfile);
  $('#profile-open-top')?.addEventListener('click', openProfile);
  $('.portal-user')?.addEventListener('dblclick', openProfile);
  $('#close-profile')?.addEventListener('click', closeProfile);
  $('#cancel-profile')?.addEventListener('click', closeProfile);
  profileModal?.addEventListener('click', event => { if (event.target === profileModal) closeProfile(); });
  profileForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = $('#save-profile');
    const payload = {};
    profileFields.forEach(field => { const input = profileForm.elements.namedItem(field); if (input) payload[field] = input.value.trim(); });
    if (payload.linkedin && !/^https:\/\//i.test(payload.linkedin)) { profileFeedback.textContent = 'Enter a valid HTTPS LinkedIn URL.'; profileFeedback.className = 'form-feedback error'; return; }
    if (payload.companyWebsite && !/^https:\/\//i.test(payload.companyWebsite)) { profileFeedback.textContent = 'Enter the company website starting with https://.'; profileFeedback.className = 'form-feedback error'; return; }
    submit.disabled = true; submit.textContent = 'Saving…';
    profileFeedback.textContent = 'Saving your changes…'; profileFeedback.className = 'form-feedback';
    try {
      // The API must update only the authenticated client's linked contact and company record.
      const result = await api('/portal/profile', { method: 'PATCH', body: JSON.stringify(payload) });
      const updated = result?.profile || result?.user || result?.contact || result || {};
      state.user = { ...state.user, ...payload, ...updated };
      hydrateUser(state.user);
      profileFeedback.textContent = 'Your client information has been updated.'; profileFeedback.className = 'form-feedback success';
      message('Your client information was updated.');
      window.setTimeout(closeProfile, 900);
    } catch (error) {
      profileFeedback.textContent = error.status === 404 || error.status === 405
        ? 'Profile editing is ready in the portal, but the deployed API does not yet support PATCH /portal/profile. Add the authenticated endpoint before clients can save changes.'
        : (error.message || 'Your changes could not be saved. Please try again.');
      profileFeedback.className = 'form-feedback error';
    } finally { submit.disabled = false; submit.textContent = 'Save changes'; }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && profileModal && !profileModal.hidden) closeProfile(); });

  // Company logo upload is stored locally in this browser until a server-side
  // client-profile logo endpoint is available. Scope it to the signed-in client/project.
  const logoInput = $('#client-logo-upload');
  const logoImage = $('#client-company-logo');
  const logoPlaceholder = $('#client-logo-placeholder');
  const logoRemove = $('#client-logo-remove');
  const logoNote = $('#client-logo-note');
  const logoStorageKey = () => {
    const identity = state.user?.id || state.user?.userId || state.user?.email || 'client';
    const project = state.project?.id || state.project?.projectId || state.project?.code || 'application';
    return `zyma-client-logo:${String(identity)}:${String(project)}`;
  };
  function showClientLogo(dataUrl) {
    if (!logoImage || !logoPlaceholder) return;
    if (dataUrl) { logoImage.src = dataUrl; logoImage.hidden = false; logoPlaceholder.hidden = true; if (logoRemove) logoRemove.hidden = false; }
    else { logoImage.removeAttribute('src'); logoImage.hidden = true; logoPlaceholder.hidden = false; if (logoRemove) logoRemove.hidden = true; }
  }
  function loadClientLogo() {
    try { showClientLogo(localStorage.getItem(logoStorageKey())); }
    catch (_) { showClientLogo(null); }
  }
  logoInput?.addEventListener('change', () => {
    const file = logoInput.files?.[0];
    if (!file) return;
    const allowed = ['image/png','image/jpeg','image/webp','image/svg+xml'];
    if (!allowed.includes(file.type)) { message('Choose a PNG, JPG, WEBP or SVG logo.'); logoInput.value = ''; return; }
    if (file.size > 2 * 1024 * 1024) { message('Logo must be 2 MB or smaller.'); logoInput.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem(logoStorageKey(), String(reader.result));
        showClientLogo(String(reader.result));
        if (logoNote) logoNote.textContent = 'Logo saved in this browser';
        message('Company logo updated on this device.');
      } catch (_) { message('Could not save the logo in this browser. Try a smaller image.'); }
    };
    reader.onerror = () => message('The selected logo could not be read.');
    reader.readAsDataURL(file);
    logoInput.value = '';
  });
  logoRemove?.addEventListener('click', () => {
    try { localStorage.removeItem(logoStorageKey()); } catch (_) {}
    showClientLogo(null);
    if (logoNote) logoNote.textContent = 'PNG, JPG, WEBP or SVG · max 2 MB';
    message('Company logo removed from this browser.');
  });

  const themeToggle = $('#theme-toggle');
  const applyTheme = theme => {
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      themeToggle.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
      const icon = $('.theme-toggle-icon', themeToggle); if (icon) icon.textContent = dark ? '☀' : '☾';
      const label = $('.theme-toggle-label', themeToggle); if (label) label.textContent = dark ? 'Light mode' : 'Dark mode';
    }
    const meta = $('meta[name="theme-color"]'); if (meta) meta.content = dark ? '#111827' : '#f6f7fb';
  };
  let savedTheme = 'light';
  try { savedTheme = localStorage.getItem('zyma-client-portal-theme') || 'light'; } catch (_) {}
  applyTheme(savedTheme);
  themeToggle?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('zyma-client-portal-theme', next); } catch (_) {}
  });
  const portalSidebar = $('#portal-sidebar');
  const mobileNavToggle = $('#mobile-nav-toggle');
  const setMobileNavOpen = open => {
    if (!portalSidebar || !mobileNavToggle) return;
    portalSidebar.classList.toggle('mobile-nav-open', open);
    mobileNavToggle.setAttribute('aria-expanded', String(open));
    mobileNavToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  };
  mobileNavToggle?.addEventListener('click', () => setMobileNavOpen(mobileNavToggle.getAttribute('aria-expanded') !== 'true'));
  $$('.portal-nav-item').forEach(button=>button.addEventListener('click',()=>{
    showSection(button.dataset.section);
    setMobileNavOpen(false);
  }));
  $$('[data-go]').forEach(button=>button.addEventListener('click',()=>{ showSection(button.dataset.go); setMobileNavOpen(false); }));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') setMobileNavOpen(false); });
  document.addEventListener('click', event => {
    if (portalSidebar?.classList.contains('mobile-nav-open') && !portalSidebar.contains(event.target)) setMobileNavOpen(false);
  });
  window.matchMedia('(min-width: 761px)').addEventListener?.('change', event => { if (event.matches) setMobileNavOpen(false); });
  const requestModal = $('#request-modal');
  const requestForm = $('#request-form');
  const requestFeedback = $('#request-feedback');
  const closeRequestModal = () => { if (requestModal) requestModal.hidden = true; };
  const openRequestModal = () => {
    if (!state.project?.id) { message('There is no project assigned to this client account yet. Please contact your Zyma representative.'); return; }
    if (requestFeedback) requestFeedback.textContent = '';
    if (requestModal) requestModal.hidden = false;
    requestForm?.querySelector('[name="subject"]')?.focus();
  };
  $$('[data-open-request]').forEach(button=>button.addEventListener('click',openRequestModal));
  $('#close-request')?.addEventListener('click',closeRequestModal);
  $('#cancel-request')?.addEventListener('click',closeRequestModal);
  requestModal?.addEventListener('click', event => { if (event.target === requestModal) closeRequestModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && requestModal && !requestModal.hidden) closeRequestModal(); });
  async function loadSupportTickets({ silent = false } = {}) {
    try {
      const result = await api('/portal/support');
      state.tickets = Array.isArray(result) ? result : (result?.tickets || result?.items || []);
      renderTickets();
    } catch (error) {
      if (!silent) message(error.message || 'Could not load support requests.');
      console.error('Could not load support requests:', error);
    }
  }
  requestForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!state.project?.id) { if (requestFeedback) requestFeedback.textContent = 'No project is assigned to this account.'; return; }
    const formData = new FormData(requestForm);
    const subject = String(formData.get('subject') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const typeLabel = String(formData.get('type') || 'General');
    const categoryMap = { 'Error / bug report': 'Bug', 'Technical assistance': 'Technical', 'Maintenance request': 'Technical', 'Change or enhancement': 'Feature', 'General question': 'General' };
    const category = categoryMap[typeLabel] || 'General';
    const location = String(formData.get('location') || '').trim();
    const priority = String(formData.get('priority') || 'Normal');
    if (!subject || !description) { if (requestFeedback) requestFeedback.textContent = 'Enter a subject and describe the issue before submitting.'; return; }
    const submit = requestForm.querySelector('[type="submit"]');
    if (submit) { submit.disabled = true; submit.textContent = 'Submitting…'; }
    if (requestFeedback) requestFeedback.textContent = 'Submitting your request securely…';
    const fullDescription = location ? `Affected page/feature: ${location}\n\n${description}` : description;
    try {
      await api('/portal/support', { method: 'POST', body: JSON.stringify({ projectId: state.project.id, subject, description: fullDescription, category, priority }) });
      requestForm.reset(); closeRequestModal();
      message('Support request submitted successfully.');
      await loadSupportTickets({ silent: true });
      showSection('support');
    } catch (error) {
      if (requestFeedback) requestFeedback.textContent = error.message || 'Your request could not be submitted. Please try again.';
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = 'Submit request ↗'; }
    }
  });
  $('#full-ticket-list')?.addEventListener('click', async event => {
    const button = event.target.closest('[data-view-ticket]');
    if (!button) return;
    try {
      const ticket = await api(`/portal/support/${encodeURIComponent(button.dataset.viewTicket)}`);
      const replies = Array.isArray(ticket.replies) ? ticket.replies : [];
      const lines = replies.map(reply => `${reply.authorRole === 'Client' ? 'You' : 'Zyma'} · ${formatDate(reply.createdAtUtc)}\n${reply.body}`).join('\n\n');
      message(`${ticket.ticketReference || 'Request'}${ticket.status ? ` · ${ticket.status}` : ''}${lines ? `\n${lines}` : ''}`);
    } catch (error) { message(error.message || 'Could not open this request.'); }
  });
  $('#ticket-filter')?.addEventListener('change',renderTickets); $('#update-filter')?.addEventListener('change',renderUpdates);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.project?.id) loadProjectDetails(state.project.id).catch(() => {});
  });
  window.addEventListener('focus', () => {
    if (state.project?.id) loadProjectUpdates(state.project.id, { silent: true });
  });
  loadPortal().then(() => {
    if (state.updateTimer) window.clearInterval(state.updateTimer);
    state.updateTimer = window.setInterval(() => {
      if (!document.hidden && state.project?.id) loadProjectDetails(state.project.id).catch(() => {});
    }, 60000);
  });
})();