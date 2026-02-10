/* ==================================================================
   DASHBOARD CENTER CAR MENECHELLI - V5.0 (GOLDEN VERSION)
   - Funcionalidades Completas
   - Mobile Otimizado (Cards finos, Scroll Coluna)
   - Gestor Híbrido (Topo PC / Menu Mobile)
   - Busca em Entregues
   - LED Restaurado
   ================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyDFbvRiLpUcXFJgVSwNobXi0fX_IceBK5k",
  authDomain: "centercarmenechelli-47e05.firebaseapp.com",
  databaseURL: "https://centercarmenechelli-47e05-default-rtdb.firebaseio.com",
  projectId: "centercarmenechelli-47e05",
  storageBucket: "centercarmenechelli-47e05.firebasestorage.app",
  messagingSenderId: "697435506647",
  appId: "1:697435506647:web:dce5cbf910f4960f732d92"
};

// --- ESTADO GLOBAL ---
let activeCloudinaryConfig = null;
let currentUser = null;
let allServiceOrders = {};
let allUsers = [];
let lightboxMedia = [];
let currentLightboxIndex = 0;
let filesToUpload = [];
const SESSION_KEY = 'centerCarSession';

const STATUS_LIST = [ 
    'Aguardando-Mecanico', 'Em-Analise', 'Orcamento-Enviado', 
    'Aguardando-Aprovacao', 'Servico-Autorizado', 'Em-Execucao', 
    'Finalizado-Aguardando-Retirada', 'Entregue' 
];

// --- NOTIFICAÇÕES ---
function showNotification(message, type = 'success') {
  const div = document.createElement('div');
  div.className = `notification ${type}`;
  div.innerHTML = `<span class="font-bold text-sm">${message}</span>`;
  document.body.appendChild(div);
  requestAnimationFrame(() => div.classList.add('show'));
  setTimeout(() => { div.classList.remove('show'); setTimeout(() => div.remove(), 300); }, 3000);
}

// --- CLOUDINARY ---
const uploadFileToCloudinary = async (file) => {
  if (!activeCloudinaryConfig) throw new Error('Configure a Mídia no menu de Gestor.');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', activeCloudinaryConfig.uploadPreset);
  
  const res = await fetch(`https://api.cloudinary.com/v1_1/${activeCloudinaryConfig.cloudName}/auto/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Erro ao enviar imagem.');
  const data = await res.json();
  return { url: data.secure_url, type: data.resource_type };
};

// --- INIT APP ---
document.addEventListener('DOMContentLoaded', () => {
  try { firebase.initializeApp(firebaseConfig); } catch(e) { console.error(e); }
  const db = firebase.database();

  // 1. CARREGAR CONFIGS E USUÁRIOS
  db.ref('cloudinaryConfigs').limitToLast(1).on('value', snap => { const val = snap.val(); if(val) activeCloudinaryConfig = Object.values(val)[0]; });

  db.ref('users').on('value', snap => {
      const data = snap.val();
      const select = document.getElementById('userSelect');
      if(!select) return;
      
      allUsers = [];
      select.innerHTML = '<option value="">Selecione...</option>';
      if (data) {
          Object.entries(data).forEach(([key, user]) => {
              allUsers.push({...user, id: key});
              const opt = document.createElement('option');
              opt.value = JSON.stringify({id: key, name: user.name, role: user.role || 'Colaborador', password: user.password});
              opt.textContent = user.name;
              select.appendChild(opt);
          });
      }
      renderAdminUserList();
      if (!currentUser) checkSession();
  });

  // 2. SESSÃO E LOGIN
  const checkSession = () => {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) return;
      try {
          const session = JSON.parse(stored);
          const now = new Date();
          const cutoff = new Date(); cutoff.setHours(19, 0, 0, 0); 
          if (now > cutoff && new Date(session.loginTime) < cutoff) {
              localStorage.removeItem(SESSION_KEY); showNotification("Sessão expirada (19h).", "error"); return;
          }
          performLogin(session.user);
      } catch (e) { localStorage.removeItem(SESSION_KEY); }
  };

  const performLogin = (user) => {
      currentUser = user;
      document.getElementById('userScreen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      document.getElementById('app').classList.add('flex');
      
      document.getElementById('currentUserName').textContent = user.name.split(' ')[0];
      
      const isManager = user.role === 'Gestor' || (user.name && user.name.includes('Thiago'));
      
      // Controle Híbrido de Botões (Desktop vs Mobile)
      const mobileAdmin = document.getElementById('adminBtnMobile');
      const mobileReports = document.getElementById('reportsBtnMobile');
      const desktopAdmin = document.getElementById('desktopAdminActions');
      const adminZone = document.getElementById('adminZone');

      if (isManager) {
          // Mobile: Mostra no dropdown
          mobileAdmin.classList.remove('hidden');
          mobileReports.classList.remove('hidden');
          // Desktop: Mostra no topo (o CSS 'md:flex' vai controlar a exibição baseada na tela)
          desktopAdmin.classList.remove('hidden'); desktopAdmin.classList.add('md:flex');
          // Ficha: Botão excluir
          adminZone.classList.remove('hidden');
      } else {
          mobileAdmin.classList.add('hidden');
          mobileReports.classList.add('hidden');
          desktopAdmin.classList.add('hidden'); desktopAdmin.classList.remove('md:flex');
          adminZone.classList.add('hidden');
      }

      initKanban();
      listenOS();
  };

  const loginForm = document.getElementById('loginForm');
  if(loginForm) loginForm.onsubmit = (e) => {
      e.preventDefault();
      const selectVal = document.getElementById('userSelect').value;
      const pass = document.getElementById('passwordInput').value;
      if(!selectVal) return;
      const user = JSON.parse(selectVal);
      if (user.password === pass) {
          localStorage.setItem(SESSION_KEY, JSON.stringify({ user: user, loginTime: new Date().toISOString() }));
          performLogin(user);
      } else {
          document.getElementById('loginError').textContent = "Senha Incorreta";
      }
  };

  document.getElementById('logoutButton').onclick = () => { localStorage.removeItem(SESSION_KEY); location.reload(); };

  // 3. MENU MOBILE & MODAIS
  const userMenuBtn = document.getElementById('userMenuBtn');
  const userDropdown = document.getElementById('userDropdown');
  if(userMenuBtn) userMenuBtn.onclick = (e) => { e.stopPropagation(); userDropdown.classList.toggle('hidden'); };
  document.onclick = (e) => { if(!userDropdown.contains(e.target) && e.target !== userMenuBtn) userDropdown.classList.add('hidden'); };

  const openModal = (id) => { document.getElementById(id).classList.remove('hidden'); document.getElementById(id).classList.add('flex'); userDropdown.classList.add('hidden'); };
  
  // Handlers para os botões (Desktop e Mobile chamam a mesma função)
  document.getElementById('adminBtn').onclick = () => openModal('adminModal');
  document.getElementById('adminBtnMobile').onclick = () => openModal('adminModal');
  document.getElementById('reportsBtn').onclick = () => openModal('reportsModal');
  document.getElementById('reportsBtnMobile').onclick = () => openModal('reportsModal');

  document.querySelectorAll('.btn-close-modal').forEach(b => b.onclick = (e) => {
      e.target.closest('.modal').classList.add('hidden'); e.target.closest('.modal').classList.remove('flex');
  });

  // 4. ADMIN & RELATÓRIOS
  document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.onclick = () => {
          document.querySelectorAll('.admin-tab').forEach(t => { t.classList.remove('border-blue-600', 'text-blue-600'); t.classList.add('text-gray-500'); });
          tab.classList.add('border-blue-600', 'text-blue-600'); tab.classList.remove('text-gray-500');
          document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
          document.getElementById(tab.dataset.target).classList.remove('hidden');
      };
  });

  const renderAdminUserList = () => {
      const list = document.getElementById('usersList');
      if(!list) return;
      list.innerHTML = allUsers.map(u => `<div class="flex justify-between items-center p-2 border-b text-sm"><span><b>${u.name}</b><br><span class="text-xs text-gray-500">${u.role}</span></span> ${u.name.includes('Thiago')?'':`<button onclick="window.removeUser('${u.id}')" class="text-red-500 p-2"><i class='bx bxs-trash'></i></button>`}</div>`).join('');
  };
  window.removeUser = (id) => { if(confirm('Remover?')) db.ref(`users/${id}`).remove(); };
  
  document.getElementById('addUserForm').onsubmit = (e) => {
      e.preventDefault();
      db.ref('users').push({ name: document.getElementById('newUserName').value, role: document.getElementById('newUserRole').value, password: document.getElementById('newUserPass').value });
      e.target.reset(); showNotification('Usuário salvo!');
  };
  document.getElementById('cloudinaryForm').onsubmit = (e) => {
      e.preventDefault();
      db.ref('cloudinaryConfigs').push({ cloudName: document.getElementById('cloudNameInput').value, uploadPreset: document.getElementById('uploadPresetInput').value });
      showNotification('Configuração Salva!');
  };

  // 5. KANBAN (Com busca em Entregues)
  const initKanban = () => {
      const board = document.getElementById('kanbanBoard');
      board.innerHTML = STATUS_LIST.map(status => `
        <div class="status-column">
            <div class="column-header">
                <span>${status.replace(/-/g, ' ')}</span>
                <span class="bg-white/50 px-2 py-0.5 rounded text-[10px]" id="count-${status}">0</span>
            </div>
            ${status === 'Entregue' ? '<input type="text" class="search-delivered" placeholder="Buscar Entregues..." onkeyup="window.filterDelivered(this.value)">' : ''}
            <div class="vehicle-list" id="col-${status}"></div>
        </div>
      `).join('');
  };

  const listenOS = () => {
      db.ref('serviceOrders').on('value', snap => {
          const data = snap.val() || {};
          allServiceOrders = data;
          STATUS_LIST.forEach(s => { document.getElementById(`col-${s}`).innerHTML = ''; });
          
          Object.entries(data).forEach(([id, os]) => {
              if(!os.status) return; os.id = id;
              const col = document.getElementById(`col-${os.status}`);
              if(col) col.innerHTML += createCard(os);
          });
          
          STATUS_LIST.forEach(s => { 
              const c = document.getElementById(`col-${s}`); 
              if(c) document.getElementById(`count-${s}`).innerText = c.children.length; 
          });
          updateAlerts();
          
          // Refresh Modal
          const modal = document.getElementById('detailsModal');
          const logId = document.getElementById('logOsId').value;
          if(!modal.classList.contains('hidden') && logId && allServiceOrders[logId]) {
              if(!document.querySelector('.editing-field')) refreshDetailsView(allServiceOrders[logId]);
              renderTimeline(allServiceOrders[logId]);
              renderGallery(allServiceOrders[logId]);
          }
      });
  };

  const createCard = (os) => {
      const idx = STATUS_LIST.indexOf(os.status);
      // Setinhas
      const prev = idx > 0 ? `<button onclick="event.stopPropagation(); window.quickMove('${os.id}','prev')" class="card-btn"><i class='bx bx-chevron-left text-lg'></i></button>` : '<div></div>';
      const next = idx < STATUS_LIST.length - 1 ? `<button onclick="event.stopPropagation(); window.quickMove('${os.id}','next')" class="card-btn"><i class='bx bx-chevron-right text-lg'></i></button>` : '<div></div>';
      
      let prioClass = os.priority === 'vermelho' ? 'border-red-500' : '';

      return `
      <div class="vehicle-card status-${os.status} ${prioClass}" onclick="window.openDetails('${os.id}')" data-search="${os.placa} ${os.cliente} ${os.modelo}">
          <div class="flex justify-between items-center mb-1">
              <span class="font-black text-slate-800 text-base">${os.placa}</span>
              ${os.priority === 'vermelho' ? '<i class="bx bxs-hot text-red-500 animate-pulse"></i>' : ''}
          </div>
          <div class="text-[11px] font-bold text-blue-700 truncate">${os.modelo}</div>
          <div class="text-[10px] text-gray-500 mt-1">${os.cliente.split(' ')[0]}</div>
          <div class="card-actions">
              ${prev} <span class="text-[9px] text-gray-300 font-bold">MOVER</span> ${next}
          </div>
      </div>`;
  };

  window.quickMove = (id, dir) => {
      const os = allServiceOrders[id]; if(!os) return;
      const idx = STATUS_LIST.indexOf(os.status);
      let newStatus = null;
      if(dir === 'next' && idx < STATUS_LIST.length-1) newStatus = STATUS_LIST[idx+1];
      if(dir === 'prev' && idx > 0) newStatus = STATUS_LIST[idx-1];
      
      if(newStatus) {
          const up = { status: newStatus, lastUpdate: new Date().toISOString() };
          // Auto-atribuição
          if(newStatus==='Em-Analise') up.responsibleForBudget=currentUser.name;
          if(newStatus==='Em-Execucao') up.responsibleForService=currentUser.name;
          if(newStatus==='Entregue') up.responsibleForDelivery=currentUser.name;
          db.ref(`serviceOrders/${id}`).update(up);
          db.ref(`serviceOrders/${id}/logs`).push({ user: currentUser.name, timestamp: new Date().toISOString(), description: `Status: ${os.status} -> ${newStatus}`, type: 'status' });
          showNotification('Status atualizado!');
      }
  };

  // BUSCA FILTRADA EM "ENTREGUE"
  window.filterDelivered = (val) => {
      const col = document.getElementById('col-Entregue');
      if(!col) return;
      const cards = col.getElementsByClassName('vehicle-card');
      Array.from(cards).forEach(card => {
          const txt = card.getAttribute('data-search').toLowerCase();
          card.style.display = txt.includes(val.toLowerCase()) ? 'block' : 'none';
      });
  };

  // 6. DETALHES, EDIÇÃO, KM
  window.openDetails = (id) => {
      const os = allServiceOrders[id]; if(!os) return;
      document.getElementById('logOsId').value = id;
      document.getElementById('logForm').reset();
      filesToUpload = []; document.getElementById('fileName').innerText='';
      document.getElementById('post-log-actions').classList.add('hidden');
      
      refreshDetailsView(os);
      renderTimeline(os);
      renderGallery(os);
      
      document.getElementById('deleteOsBtn').onclick = () => {
          document.getElementById('confirmDeleteText').innerText = `Apagar ${os.placa}?`;
          document.getElementById('confirmDeleteBtn').onclick = async () => {
              await db.ref(`serviceOrders/${id}`).remove();
              document.getElementById('confirmDeleteModal').classList.add('hidden');
              document.getElementById('detailsModal').classList.add('hidden');
              document.getElementById('detailsModal').classList.remove('flex');
          };
          document.getElementById('confirmDeleteModal').classList.remove('hidden');
          document.getElementById('confirmDeleteModal').classList.add('flex');
      };
      
      document.getElementById('exportOsBtn').onclick = () => printOS(os);
      openModal('detailsModal');
  };

  const refreshDetailsView = (os) => {
      const isManager = currentUser && (currentUser.role === 'Gestor' || currentUser.name.includes('Thiago'));
      const editIcon = (field) => isManager ? `<i class='bx bx-edit text-gray-400 cursor-pointer hover:text-blue-600' onclick="window.toggleEdit('${field}','${os.id}')"></i>` : '';
      
      const fieldHtml = (field, val, label) => `
        <div class="bg-gray-50 p-2 rounded border">
            <div class="flex justify-between"><span class="text-[10px] text-slate-400 font-bold">${label}</span> ${editIcon(field)}</div>
            <div id="view-${field}" class="font-bold text-sm text-slate-800">${val||'-'}</div>
            <div id="edit-${field}" class="hidden flex gap-1 mt-1">
                <input id="input-${field}" value="${val||''}" class="w-full p-1 text-sm border rounded">
                <button onclick="window.saveEdit('${field}','${os.id}')" class="text-green-600"><i class='bx bx-check'></i></button>
                <button onclick="window.cancelEdit('${field}')" class="text-red-500"><i class='bx bx-x'></i></button>
            </div>
        </div>`;

      document.getElementById('modalTitlePlaca').innerHTML = `${os.placa} ${isManager?`<i class='bx bx-edit text-sm cursor-pointer text-gray-300' onclick="window.toggleEdit('placa','${os.id}',true)"></i>`:''}`;
      document.getElementById('modalTitleModelo').innerText = `${os.modelo}`;
      
      document.getElementById('detailsInfoContent').innerHTML = `
          <div class="grid grid-cols-2 gap-2 mb-3">
              ${fieldHtml('cliente', os.cliente, 'CLIENTE')}
              ${fieldHtml('telefone', os.telefone, 'TEL')}
              ${fieldHtml('modelo', os.modelo, 'VEÍCULO')}
              <div class="bg-gray-50 p-2 rounded border"><span class="text-[10px] text-slate-400 font-bold">RESP.</span><div class="font-bold text-sm">${os.responsible}</div></div>
          </div>
          <div class="bg-blue-50 p-2 rounded flex justify-between items-center mb-3 border border-blue-100">
              <div><span class="text-[10px] font-bold text-blue-800">KM ATUAL</span><div class="font-black text-lg">${os.km||'--'}</div></div>
              <div class="flex gap-1"><input id="quickKmInput" type="number" placeholder="KM" class="w-20 p-1 rounded border text-center text-sm"><button onclick="window.saveKm('${os.id}')" class="bg-blue-600 text-white px-3 rounded font-bold text-sm">OK</button></div>
          </div>
          <div class="bg-red-50 p-2 rounded border-l-4 border-red-500">
              <div class="flex justify-between"><span class="text-[10px] font-bold text-red-800">RECLAMAÇÃO</span> ${editIcon('observacoes')}</div>
              <div id="view-observacoes" class="text-xs text-red-900">${os.observacoes||''}</div>
              <div id="edit-observacoes" class="hidden mt-2"><textarea id="input-observacoes" class="w-full p-2 border rounded text-sm" rows="3">${os.observacoes||''}</textarea><div class="flex justify-end gap-2 mt-1"><button onclick="window.cancelEdit('observacoes')" class="text-xs underline">Cancel</button><button onclick="window.saveEdit('observacoes','${os.id}')" class="bg-red-600 text-white px-3 rounded text-xs font-bold">Salvar</button></div></div>
          </div>`;
  };

  window.toggleEdit = (field, id, promptMode=false) => {
      if(promptMode && field === 'placa') {
          const novo = prompt('Nova Placa:', allServiceOrders[id].placa);
          if(novo) { db.ref(`serviceOrders/${id}`).update({placa: novo.toUpperCase()}); logEdit(id, 'Placa', novo.toUpperCase()); }
          return;
      }
      document.getElementById(`view-${field}`).classList.add('hidden');
      document.getElementById(`edit-${field}`).classList.remove('hidden');
      document.getElementById(`edit-${field}`).classList.add('editing-field');
  };
  window.cancelEdit = (field) => {
      document.getElementById(`view-${field}`).classList.remove('hidden');
      document.getElementById(`edit-${field}`).classList.add('hidden');
      document.getElementById(`edit-${field}`).classList.remove('editing-field');
  };
  window.saveEdit = (field, id) => {
      const val = document.getElementById(`input-${field}`).value;
      const up = {}; up[field] = val;
      db.ref(`serviceOrders/${id}`).update(up);
      logEdit(id, field, val);
      window.cancelEdit(field);
  };
  window.saveKm = (id) => {
      const km = document.getElementById('quickKmInput').value;
      if(km) { db.ref(`serviceOrders/${id}`).update({km: km}); logEdit(id, 'KM', km); showNotification('KM Atualizado!'); }
  };
  const logEdit = (id, field, val) => db.ref(`serviceOrders/${id}/logs`).push({user: currentUser.name, timestamp: new Date().toISOString(), description: `Editou ${field} para ${val}`, type: 'log'});

  // 7. RESTO DA LÓGICA (MÍDIA, RELATÓRIOS, TIMELINE)
  const renderTimeline = (os) => {
      const el = document.getElementById('timelineContainer');
      if(!os.logs) { el.innerHTML = '<p class="text-center text-xs text-gray-400">Vazio</p>'; return; }
      const logs = Object.entries(os.logs).sort((a,b)=>new Date(b[1].timestamp)-new Date(a[1].timestamp));
      el.innerHTML = logs.map(([k,l]) => `<div class="border-l-2 border-gray-200 pl-3 pb-3 relative"><div class="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-blue-500"></div><div class="flex justify-between"><span class="font-bold text-xs text-blue-900">${l.user}</span><span class="text-[10px] text-gray-400">${new Date(l.timestamp).toLocaleString()}</span></div><p class="text-xs bg-white p-2 rounded border mt-1">${l.description} ${l.parts?`<br><b>Peças:</b> ${l.parts} | <b>R$</b> ${l.value}`:''}</p>${currentUser.role==='Gestor'?`<button onclick="window.deleteLog('${os.id}','${k}')" class="text-[10px] text-red-400 mt-1">Excluir</button>`:''}</div>`).join('');
  };
  window.deleteLog = (id,k) => { if(confirm('Apagar?')) db.ref(`serviceOrders/${id}/logs/${k}`).remove(); };

  const renderGallery = (os) => {
      const el = document.getElementById('thumbnail-grid');
      if(!os.media) { el.innerHTML = '<p class="col-span-full text-center text-xs text-gray-400">Sem mídia</p>'; return; }
      const m = Object.entries(os.media); lightboxMedia = m.map(x=>x[1]);
      el.innerHTML = m.map(([k,v], i) => `<div class="aspect-square bg-gray-100 rounded relative overflow-hidden border" onclick="window.openLightbox(${i})">${v.type.includes('video')?'<i class="bx bx-play-circle text-2xl absolute inset-0 flex items-center justify-center"></i>':`<img src="${v.url}" class="w-full h-full object-cover">`}${currentUser.role==='Gestor'?`<button onclick="event.stopPropagation();window.deleteMedia('${os.id}','${k}')" class="absolute top-0 right-0 bg-red-600 text-white w-5 h-5 flex items-center justify-center text-xs">&times;</button>`:''}</div>`).join('');
  };
  window.deleteMedia = (id,k) => { if(confirm('Apagar?')) db.ref(`serviceOrders/${id}/media/${k}`).remove(); };
  window.openLightbox = (i) => {
      currentLightboxIndex = i; const m = lightboxMedia[i];
      const c = document.getElementById('lightbox-content');
      c.innerHTML = m.type.includes('image') ? `<img src="${m.url}" class="max-h-full max-w-full rounded">` : `<video src="${m.url}" controls autoplay class="max-h-full max-w-full rounded"></video>`;
      openModal('lightbox');
  };
  document.getElementById('lightbox-close').onclick = () => { document.getElementById('lightbox').classList.add('hidden'); document.getElementById('lightbox').classList.remove('flex'); };

  const logForm = document.getElementById('logForm');
  if(logForm) logForm.onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]'); btn.disabled=true; btn.innerText='...';
      const id = document.getElementById('logOsId').value;
      try {
          if(filesToUpload.length) { const res = await Promise.all(filesToUpload.map(f => uploadFileToCloudinary(f))); res.forEach(r => db.ref(`serviceOrders/${id}/media`).push(r)); }
          const d = document.getElementById('logDescricao').value;
          if(d || document.getElementById('logValor').value) db.ref(`serviceOrders/${id}/logs`).push({user: currentUser.name, timestamp: new Date().toISOString(), description: d, parts: document.getElementById('logPecas').value, value: document.getElementById('logValor').value });
          showNotification('Salvo!'); e.target.reset(); filesToUpload=[]; document.getElementById('fileName').innerText='';
          document.getElementById('post-log-actions').classList.remove('hidden');
      } catch(err) { showNotification(err.message, 'error'); }
      btn.disabled=false; btn.innerText='SALVAR NO HISTÓRICO';
  };
  
  // Movimentação via Log
  document.getElementById('btn-move-next').onclick = () => window.quickMove(document.getElementById('logOsId').value, 'next');
  document.getElementById('btn-move-prev').onclick = () => window.quickMove(document.getElementById('logOsId').value, 'prev');
  document.getElementById('btn-stay').onclick = () => document.getElementById('post-log-actions').classList.add('hidden');

  // Relatório
  document.getElementById('reportsForm').onsubmit = (e) => {
      e.preventDefault();
      const i = new Date(document.getElementById('startDate').value);
      const f = new Date(document.getElementById('endDate').value); f.setHours(23,59,59);
      const res = Object.values(allServiceOrders).filter(o => o.status === 'Entregue' && new Date(o.lastUpdate) >= i && new Date(o.lastUpdate) <= f);
      const c = document.getElementById('reportsResultContainer');
      const btn = document.getElementById('exportReportBtn');
      if(!res.length) { c.innerHTML='<p class="text-center p-4 text-xs">Nada encontrado.</p>'; btn.classList.add('hidden'); return; }
      
      c.innerHTML = `<table class="w-full text-xs"><thead><tr class="bg-gray-200 text-left"><th class="p-1">Data</th><th class="p-1">Placa</th><th class="p-1">Cliente</th></tr></thead><tbody>${res.map(r=>`<tr class="border-b"><td class="p-1">${new Date(r.lastUpdate).toLocaleDateString()}</td><td class="p-1 font-bold">${r.placa}</td><td class="p-1">${r.cliente}</td></tr>`).join('')}</tbody></table>`;
      btn.classList.remove('hidden');
      btn.onclick = () => {
          const w = window.open('','','width=800,height=600');
          w.document.write(`<html><head><style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px;text-align:left}</style></head><body><h2>Relatório</h2>${c.innerHTML}<script>window.print()</script></body></html>`);
          w.document.close();
      };
  };

  // Inputs Mídia
  const fIn = document.getElementById('media-input');
  if(fIn) fIn.onchange = (e) => { filesToUpload = Array.from(e.target.files); document.getElementById('fileName').innerText = `${filesToUpload.length} arqs`; };
  document.getElementById('openCameraBtn').onclick = () => { fIn.setAttribute('capture','environment'); fIn.click(); };
  document.getElementById('openGalleryBtn').onclick = () => { fIn.removeAttribute('capture'); fIn.click(); };

  // Nova OS
  document.getElementById('addOSBtn').onclick = () => {
      document.getElementById('osForm').reset();
      document.getElementById('osResponsavel').innerHTML = document.getElementById('userSelect').innerHTML;
      openModal('osModal');
  };
  document.getElementById('osForm').onsubmit = (e) => {
      e.preventDefault();
      const prio = document.querySelector('input[name=osPrioridade]:checked').value;
      const resp = JSON.parse(document.getElementById('osResponsavel').value).name;
      db.ref('serviceOrders').push({
          placa: document.getElementById('osPlaca').value.toUpperCase(),
          modelo: document.getElementById('osModelo').value,
          cliente: document.getElementById('osCliente').value,
          telefone: document.getElementById('osTelefone').value,
          km: document.getElementById('osKm').value,
          responsible: resp, observacoes: document.getElementById('osObservacoes').value,
          priority: prio, status: 'Aguardando-Mecanico', createdAt: new Date().toISOString()
      });
      document.getElementById('osModal').classList.add('hidden'); document.getElementById('osModal').classList.remove('flex');
      showNotification('Ficha Criada!');
  };

  // Busca Global
  document.getElementById('globalSearchInput').oninput = (e) => {
      const v = e.target.value.toUpperCase();
      const r = document.getElementById('globalSearchResults');
      if(v.length<2) { r.classList.add('hidden'); return; }
      const f = Object.values(allServiceOrders).filter(o => (o.placa+o.cliente+o.modelo).toUpperCase().includes(v));
      r.innerHTML = f.length ? f.map(o=>`<div class="p-2 border-b hover:bg-gray-50 cursor-pointer flex justify-between items-center" onclick="window.openDetails('${o.id}');document.getElementById('globalSearchResults').classList.add('hidden')"><div><b class="text-sm">${o.placa}</b> <span class="text-xs text-gray-500">${o.modelo}</span></div><span class="text-[10px] bg-blue-100 px-2 rounded">${o.status}</span></div>`).join('') : '<div class="p-2 text-center text-xs">Nada</div>';
      r.classList.remove('hidden');
  };

  const updateAlerts = () => {
      const alertPanel = document.getElementById('attention-panel');
      const led = document.getElementById('alert-led');
      const ledStatic = document.getElementById('alert-led-static');
      
      const alerts = Object.values(allServiceOrders).filter(o => ['Aguardando-Mecanico','Servico-Autorizado'].includes(o.status));
      
      if(led) {
          if(alerts.length) {
              led.classList.remove('hidden'); ledStatic.classList.remove('hidden');
          } else {
              led.classList.add('hidden'); ledStatic.classList.add('hidden');
          }
      }
      
      if(alertPanel) alertPanel.innerHTML = alerts.map(o => `<div class="bg-slate-700 p-2 rounded text-white text-xs cursor-pointer border-l-4 ${o.status.includes('Mecanico')?'border-yellow-500':'border-green-500'}" onclick="window.openDetails('${o.id}')"><b>${o.placa}</b> ${o.status.replace(/-/g,' ')}</div>`).join('');
  };
  document.getElementById('toggle-panel-btn').onclick = () => {
      const c = document.getElementById('attention-panel-container');
      c.style.maxHeight = c.style.maxHeight ? null : '200px';
  };
});