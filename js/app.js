/* ==================================================================
   DASHBOARD CENTER CAR MENECHELLI - V3.0 (PRO)
   Desenvolvido por: thIAguinho Soluções
   ================================================================== */

// CONFIGURAÇÃO REAL DO FIREBASE DO CENTER CAR
const firebaseConfig = {
  apiKey: "AIzaSyDFbvRiLpUcXFJgVSwNobXi0fX_IceBK5k",
  authDomain: "centercarmenechelli-47e05.firebaseapp.com",
  databaseURL: "https://centercarmenechelli-47e05-default-rtdb.firebaseio.com",
  projectId: "centercarmenechelli-47e05",
  storageBucket: "centercarmenechelli-47e05.firebasestorage.app",
  messagingSenderId: "697435506647",
  appId: "1:697435506647:web:dce5cbf910f4960f732d92"
};

// --- VARIÁVEIS GLOBAIS ---
let activeCloudinaryConfig = null;
let currentUser = null;
let allServiceOrders = {};
let allUsers = []; 
let lightboxMedia = [];
let currentLightboxIndex = 0;
let filesToUpload = [];
let appStartTime = Date.now();

// --- STATUS ---
const STATUS_LIST = [ 
    'Aguardando-Mecanico', 'Em-Analise', 'Orcamento-Enviado', 
    'Aguardando-Aprovacao', 'Servico-Autorizado', 'Em-Execucao', 
    'Finalizado-Aguardando-Retirada', 'Entregue' 
];

const ATTENTION_STATUSES = { 
    'Aguardando-Mecanico': { label: 'AGUARDANDO MECÂNICO', color: 'yellow', blinkClass: 'blinking-aguardando' }, 
    'Servico-Autorizado': { label: 'SERVIÇO AUTORIZADO', color: 'green', blinkClass: 'blinking-autorizado' } 
};
const LED_TRIGGER_STATUSES = ['Aguardando-Mecanico', 'Servico-Autorizado'];

// --- NOTIFICAÇÕES ---
function showNotification(message, type = 'success') {
  const existing = document.getElementById('notification');
  if (existing) {
    existing.remove();
  }
  const notification = document.createElement('div');
  notification.id = 'notification';
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 500);
  }, 4000);
}

// --- CLOUDINARY UPLOAD ---
const uploadFileToCloudinary = async (file) => {
  if (!activeCloudinaryConfig) {
      throw new Error('Mídia não configurada. Fale com o Admin.');
  }
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', activeCloudinaryConfig.uploadPreset);
  
  const res = await fetch(`https://api.cloudinary.com/v1_1/${activeCloudinaryConfig.cloudName}/auto/upload`, {
      method: 'POST', body: formData
  });
  
  if (!res.ok) throw new Error('Falha no upload da imagem.');
  const data = await res.json();
  return { 
      url: data.secure_url, 
      type: data.resource_type,
      configKey: activeCloudinaryConfig.key 
  };
};

const formatStatus = (status) => status.replace(/-/g, ' ');

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  // Elementos
  const userScreen = document.getElementById('userScreen');
  const app = document.getElementById('app');
  const userSelect = document.getElementById('userSelect');
  const passwordInput = document.getElementById('passwordInput');
  const loginError = document.getElementById('loginError');
  const kanbanBoard = document.getElementById('kanbanBoard');
  const osModal = document.getElementById('osModal');
  const detailsModal = document.getElementById('detailsModal');
  const adminModal = document.getElementById('adminModal');
  const reportsModal = document.getElementById('reportsModal');
  const attentionPanel = document.getElementById('attention-panel');
  const attentionPanelContainer = document.getElementById('attention-panel-container');
  const logForm = document.getElementById('logForm');
  const detailsHeader = document.getElementById('detailsHeader');
  const timelineContainer = document.getElementById('timelineContainer');
  const thumbnailGrid = document.getElementById('thumbnail-grid');
  const adminBtn = document.getElementById('adminBtn');
  const reportsBtn = document.getElementById('reportsBtn');
  const globalSearchInput = document.getElementById('globalSearchInput');
  const globalSearchResults = document.getElementById('globalSearchResults');

  // 1. CARREGAR/CRIAR USUÁRIOS (Lógica Dinâmica Center Car)
  const usersRef = db.ref('users');
  usersRef.on('value', snapshot => {
      const data = snapshot.val();
      userSelect.innerHTML = '<option value="">Selecione...</option>';
      allUsers = [];

      if (!data) {
          const master = { name: 'Thiago Ventura Valencio', role: 'Gestor', password: 'dev' };
          usersRef.push(master);
          return;
      }

      Object.entries(data).forEach(([key, user]) => {
          user.id = key;
          allUsers.push(user);
          const opt = document.createElement('option');
          opt.value = user.id;
          opt.textContent = user.name;
          userSelect.appendChild(opt);
      });
      renderAdminUserList();
  });

  // 2. CARREGAR CONFIG MÍDIA
  db.ref('cloudinaryConfigs').limitToLast(1).on('value', snap => {
      const val = snap.val();
      if(val) {
          const key = Object.keys(val)[0];
          activeCloudinaryConfig = { ...val[key], key: key };
          const infoEl = document.getElementById('activeCloudinaryInfo');
          if(infoEl) infoEl.innerHTML = `<span class="text-green-600 font-bold">Ativo:</span> ${activeCloudinaryConfig.cloudName}`;
      }
  });

  // 3. LOGIN & LOGOUT
  const logoutUser = () => {
    localStorage.removeItem('currentUserSession');
    location.reload();
  };

  const scheduleDailyLogout = () => {
    const now = new Date();
    const logoutTime = new Date();
    logoutTime.setHours(19, 0, 0, 0);

    if (now > logoutTime) {
      logoutTime.setDate(logoutTime.getDate() + 1);
    }
    const timeUntilLogout = logoutTime.getTime() - now.getTime();
    setTimeout(() => {
      if (localStorage.getItem('currentUserSession')) {
        showNotification('Sessão encerrada por segurança.', 'success');
        setTimeout(logoutUser, 2000);
      }
    }, timeUntilLogout);
  };

  const loginUser = (user) => {
      const sessionData = { user: user, loginTime: new Date().toISOString() };
      localStorage.setItem('currentUserSession', JSON.stringify(sessionData));

      currentUser = user;
      document.getElementById('currentUserName').textContent = user.name;
      userScreen.classList.add('hidden');
      app.classList.remove('hidden');
      app.classList.add('flex'); // Center car usa flex-col

      // Permissões Admin
      if (user.role === 'Gestor' || user.name === 'Thiago Ventura Valencio') {
          adminBtn.classList.remove('hidden');
          reportsBtn.classList.remove('hidden');
      }

      initKanban();
      listenOS();
      scheduleDailyLogout();
  };

  document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const userId = userSelect.value;
      const pass = passwordInput.value;
      const user = allUsers.find(u => u.id === userId);

      if (user && user.password === pass) {
          loginUser(user);
      } else {
          loginError.textContent = "Senha Incorreta!";
      }
  });

  document.getElementById('logoutButton').addEventListener('click', logoutUser);

  // Auto Login
  const storedSession = localStorage.getItem('currentUserSession');
  if (storedSession) {
      const sessionData = JSON.parse(storedSession);
      // Validação básica de expiração diária
      const loginTime = new Date(sessionData.loginTime);
      const now = new Date();
      const lastCutoff = new Date();
      lastCutoff.setHours(19, 0, 0, 0);
      if (now < lastCutoff) lastCutoff.setDate(lastCutoff.getDate() - 1);

      if (loginTime < lastCutoff) {
          logoutUser();
      } else {
          // Espera carregar usuários para logar
          const checkUsers = setInterval(() => {
              if (allUsers.length > 0) {
                  const user = allUsers.find(u => u.name === sessionData.user.name); // Busca pelo nome para persistir
                  if (user) {
                      loginUser(user);
                      clearInterval(checkUsers);
                  }
              }
          }, 100);
      }
  }

  // 4. KANBAN (Lógica do CHEVRON com Colapsar)
  const initKanban = () => {
      const collapsedState = JSON.parse(localStorage.getItem('collapsedColumns')) || {};
      
      kanbanBoard.innerHTML = STATUS_LIST.map(status => {
          const isCollapsed = collapsedState[status];
          const searchInputHTML = status === 'Entregue'
            ? `<div class="my-2"><input type="search" data-status="${status}" placeholder="Buscar por Placa..." class="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 search-input-entregue"></div>`
            : '';
          const columnLedHTML = isCollapsed ? '<div class="column-led ml-2"></div>' : '';
          
          return `
          <div class="status-column p-4">
              <div class="flex justify-between items-center cursor-pointer toggle-column-btn mb-2" data-status="${status}">
                  <div class="flex items-center">
                      <h3 class="font-bold text-gray-800 text-sm uppercase">${status.replace(/-/g, ' ')}</h3>
                      ${columnLedHTML}
                  </div>
                  <i class='bx bxs-chevron-down transition-transform ${isCollapsed ? 'rotate-180' : ''}'></i>
              </div>
              ${searchInputHTML}
              <div class="space-y-3 vehicle-list ${isCollapsed ? 'collapsed' : ''}" data-status="${status}"></div>
          </div>`;
      }).join('');
      updateAttentionPanel();
  };

  const createCardHTML = (os) => {
    const currentIndex = STATUS_LIST.indexOf(os.status);
    const prevStatus = currentIndex > 0 ? STATUS_LIST[currentIndex - 1] : null;
    const nextStatus = currentIndex < STATUS_LIST.length - 1 ? STATUS_LIST[currentIndex + 1] : null;
    const prevButton = prevStatus ? `<button data-os-id="${os.id}" data-new-status="${prevStatus}" class="btn-move-status p-2 rounded-full hover:bg-gray-100 transition-colors"><i class='bx bx-chevron-left text-xl text-gray-600'></i></button>` : `<div class="w-10 h-10"></div>`;
    const nextButton = nextStatus ? `<button data-os-id="${os.id}" data-new-status="${nextStatus}" class="btn-move-status p-2 rounded-full hover:bg-gray-100 transition-colors"><i class='bx bx-chevron-right text-xl text-gray-600'></i></button>` : `<div class="w-10 h-10"></div>`;
    const kmInfo = `<p class="text-xs text-gray-500">KM: ${os.km ? new Intl.NumberFormat('pt-BR').format(os.km) : 'N/A'}</p>`;
    const priorityIndicatorHTML = os.priority ? `<div class="priority-indicator priority-${os.priority}" title="Urgência: ${os.priority}"></div>` : '';
    
    return `<div id="${os.id}" class="vehicle-card status-${os.status}" data-os-id="${os.id}">${priorityIndicatorHTML}<div class="flex justify-between items-start"><div class="card-clickable-area cursor-pointer flex-grow"><p class="font-bold text-base text-gray-800">${os.placa}</p><p class="text-sm text-gray-600">${os.modelo}</p><div class="text-xs mt-1">${kmInfo}</div></div><div class="flex flex-col -mt-1 -mr-1">${nextButton}${prevButton}</div></div></div>`;
  };

  const renderDeliveredColumn = () => {
      const list = kanbanBoard.querySelector('.vehicle-list[data-status="Entregue"]');
      if (!list) return;
      const searchInput = kanbanBoard.querySelector('.search-input-entregue');
      const searchTerm = searchInput ? searchInput.value.toUpperCase().trim() : '';
      let deliveredItems = Object.values(allServiceOrders).filter(os => os.status === 'Entregue');
      if (searchTerm) {
          deliveredItems = deliveredItems.filter(os => (os.placa && os.placa.toUpperCase().includes(searchTerm)) || (os.modelo && os.modelo.toUpperCase().includes(searchTerm)));
      }
      deliveredItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      list.innerHTML = deliveredItems.map(os => createCardHTML(os)).join('');
  };

  const listenOS = () => {
      const osRef = db.ref('serviceOrders');
      osRef.on('child_added', snapshot => {
          const os = { ...snapshot.val(), id: snapshot.key };
          allServiceOrders[os.id] = os;
          if (os.status === 'Entregue') {
              renderDeliveredColumn();
          } else {
              const list = kanbanBoard.querySelector(`.vehicle-list[data-status="${os.status}"]`);
              if (list) { list.insertAdjacentHTML('beforeend', createCardHTML(os)); }
          }
          updateAttentionPanel();
      });
      osRef.on('child_changed', snapshot => {
          const os = { ...snapshot.val(), id: snapshot.key };
          const oldOs = allServiceOrders[os.id];
          allServiceOrders[os.id] = os;
          const existingCard = document.getElementById(os.id);
          
          if (oldOs && oldOs.status !== os.status) {
              if (existingCard) existingCard.remove();
              if (os.status === 'Entregue') {
                  renderDeliveredColumn();
              } else {
                  const newList = kanbanBoard.querySelector(`.vehicle-list[data-status="${os.status}"]`);
                  if (newList) newList.insertAdjacentHTML('beforeend', createCardHTML(os));
              }
              if(oldOs.status === 'Entregue') { renderDeliveredColumn(); }
          }
          else if (existingCard) {
              existingCard.outerHTML = createCardHTML(os);
          }
           if (detailsModal.classList.contains('flex') && document.getElementById('logOsId').value === os.id) {
                renderTimeline(os);
                renderMediaGallery(os);
           }
          updateAttentionPanel();
      });
      osRef.on('child_removed', snapshot => {
          const osId = snapshot.key;
          const removedOs = allServiceOrders[osId];
          delete allServiceOrders[osId];
          if (removedOs && removedOs.status === 'Entregue') {
              renderDeliveredColumn();
          } else {
              const cardToRemove = document.getElementById(osId);
              if (cardToRemove) cardToRemove.remove();
          }
          updateAttentionPanel();
      });
  };

  const updateAttentionPanel = () => {
    let vehiclesTriggeringAlert = new Set();
    Object.values(allServiceOrders).forEach(os => {
        if (LED_TRIGGER_STATUSES.includes(os.status)) { vehiclesTriggeringAlert.add(os.id); }
    });
    
    attentionPanel.innerHTML = Object.entries(ATTENTION_STATUSES).map(([statusKey, config]) => {
        const vehiclesInStatus = Object.values(allServiceOrders).filter(os => os.status === statusKey);
        const hasVehicles = vehiclesInStatus.length > 0;
        const blinkingClass = (hasVehicles && config.blinkClass && !attentionPanelContainer.classList.contains('collapsed')) ? config.blinkClass : '';
        const vehicleListHTML = hasVehicles
            ? vehiclesInStatus.map(os => `<p class="cursor-pointer attention-vehicle text-white hover:text-blue-300" data-os-id="${os.id}">${os.placa} - ${os.modelo}</p>`).join('')
            : `<p class="text-gray-400">- Vazio -</p>`;
        return `<div class="attention-box p-2 rounded-md bg-gray-900 border-2 border-gray-700 ${blinkingClass}" data-status-key="${statusKey}"><h3 class="text-center text-${config.color}-400 font-bold text-xs sm:text-sm truncate">${config.label}</h3><div class="mt-1 text-center text-white text-xs space-y-1 h-16 overflow-y-auto">${vehicleListHTML}</div></div>`;
    }).join('');
    
    const led = document.getElementById('alert-led');
    if (vehiclesTriggeringAlert.size > 0 && attentionPanelContainer.classList.contains('collapsed')) {
        led.classList.remove('hidden');
    } else {
        led.classList.add('hidden');
    }
  };

  // 5. ATUALIZAÇÃO DE STATUS (LÓGICA CHEVRON)
  const updateServiceOrderStatus = async (osId, newStatus) => {
      const os = allServiceOrders[osId];
      if (!os) return;
      const oldStatus = os.status;
      const logEntry = { 
          timestamp: new Date().toISOString(), 
          user: currentUser.name, 
          description: `Status alterado de "${formatStatus(oldStatus)}" para "${formatStatus(newStatus)}".`, 
          type: 'status' 
      };
      const updates = { status: newStatus, lastUpdate: new Date().toISOString() };
      
      // Atribuição automática de responsabilidade
      if (newStatus === 'Em-Analise') updates.responsibleForBudget = currentUser.name;
      else if (newStatus === 'Em-Execucao') updates.responsibleForService = currentUser.name;
      else if (newStatus === 'Entregue') updates.responsibleForDelivery = currentUser.name;

      try {
          await db.ref(`serviceOrders/${osId}/logs`).push().set(logEntry);
          await db.ref(`serviceOrders/${osId}`).update(updates);
          showNotification(`O.S. ${os.placa} movida para ${formatStatus(newStatus)}`);
      } catch (error) {
          console.error("Erro ao atualizar status:", error);
          showNotification("Falha ao mover O.S.", "error");
      }
  };

  // 6. MODAL DE DETALHES
  const openDetailsModal = (osId) => {
    const os = allServiceOrders[osId];
    if (!os) return;

    const canEdit = currentUser && (currentUser.name === 'Thiago Ventura Valencio' || currentUser.role === 'Gestor');
    const editIconHTML = `<i class='bx bxs-edit-alt text-gray-400 hover:text-blue-600 cursor-pointer ml-2 text-lg'></i>`;

    const renderHeader = (currentOs) => {
        detailsHeader.innerHTML = `
            <div class="mb-4">
                <h2 id="detailsPlacaModelo" class="text-3xl font-bold text-gray-800 inline-flex items-center">
                    <span data-field="placa">${currentOs.placa}</span>
                    ${canEdit ? `<span class="edit-btn" data-field="placa">${editIconHTML}</span>` : ''}
                    <span class="mx-2">-</span>
                    <span data-field="modelo">${currentOs.modelo}</span>
                    ${canEdit ? `<span class="edit-btn" data-field="modelo">${editIconHTML}</span>` : ''}
                </h2>
                <p id="detailsCliente" class="text-lg text-gray-600 mt-1">
                    <span>Cliente: </span>
                    <span data-field="cliente">${currentOs.cliente}</span>
                    ${canEdit ? `<span class="edit-btn" data-field="cliente">${editIconHTML}</span>` : ''}
                    <br>
                    <span class="text-sm text-gray-500">
                        Telefone: <span data-field="telefone">${currentOs.telefone || 'Não informado'}</span>
                        ${canEdit ? `<span class="edit-btn" data-field="telefone">${editIconHTML}</span>` : ''}
                    </span>
                </p>
                <p id="detailsKm" class="text-lg text-blue-800 font-bold mt-1">KM: ${currentOs.km ? new Intl.NumberFormat('pt-BR').format(currentOs.km) : 'N/A'}</p>
            </div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm w-full sm:w-auto">
                <div class="font-semibold text-gray-500">Atendente:</div><div id="responsible-attendant">${currentOs.responsible || 'N/D'}</div>
                <div class="font-semibold text-gray-500">Orçamento:</div><div id="responsible-budget">${currentOs.responsibleForBudget || 'N/D'}</div>
                <div class="font-semibold text-gray-500">Serviço:</div><div id="responsible-service">${currentOs.responsibleForService || 'N/D'}</div>
                <div class="font-semibold text-gray-500">Entrega:</div><div id="responsible-delivery">${currentOs.responsibleForDelivery || 'N/D'}</div>
            </div>`;
    };

    renderHeader(os);

    const observacoesContainer = document.getElementById('detailsObservacoes');
    if (os.observacoes) {
      observacoesContainer.innerHTML = `
        <div class="flex justify-between items-center">
            <h4 class="text-sm font-semibold text-gray-500 mb-1">Queixa do Cliente:</h4>
            ${canEdit ? `<span class="edit-btn" data-field="observacoes">${editIconHTML}</span>` : ''}
        </div>
        <p class="text-gray-800 bg-yellow-100 p-3 rounded-md whitespace-pre-wrap" data-field="observacoes">${os.observacoes}</p>`;
      observacoesContainer.classList.remove('hidden');
    } else {
        observacoesContainer.innerHTML = `
        <div class="flex justify-between items-center">
             <h4 class="text-sm font-semibold text-gray-500 mb-1">Queixa do Cliente:</h4>
             ${canEdit ? `<span class="edit-btn" data-field="observacoes">${editIconHTML}</span>` : ''}
        </div>
        <p class="text-gray-400 italic p-3 rounded-md" data-field="observacoes">Nenhuma queixa inicial registrada.</p>`;
      observacoesContainer.classList.remove('hidden');
    }
    
    // Controle de Exclusão
    if (currentUser && (currentUser.role === 'Gestor' || currentUser.role === 'Atendente')) {
        document.getElementById('deleteOsBtn').classList.remove('hidden');
    } else {
        document.getElementById('deleteOsBtn').classList.add('hidden');
    }
    
    document.getElementById('logOsId').value = osId;
    logForm.reset();
    document.getElementById('fileName').textContent = '';
    filesToUpload = [];
    document.getElementById('post-log-actions').style.display = 'none';
    
    renderTimeline(os);
    renderMediaGallery(os);
    
    detailsModal.classList.remove('hidden');
    detailsModal.classList.add('flex');
  };

  const renderTimeline = (os) => {
    const logs = os.logs || {};
    const logEntries = Object.entries(logs).sort(([,a], [,b]) => new Date(b.timestamp) - new Date(a.timestamp));

    timelineContainer.innerHTML = logEntries.map(([logId, log]) => {
      const date = new Date(log.timestamp);
      const formattedDate = date.toLocaleDateString('pt-BR');
      const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      let iconClass = 'bx-message-detail';
      let itemClass = 'timeline-item-log';
      if (log.type === 'status') { iconClass = 'bx-transfer'; itemClass = 'timeline-item-status'; }
      else if (log.value) { iconClass = 'bx-dollar'; itemClass = 'timeline-item-value'; }

      const canDelete = (currentUser.role === 'Gestor' || currentUser.role === 'Atendente') && log.description && !log.description.startsWith('ATT EXCLUIDA');
      const deleteButtonHTML = canDelete
        ? `<button class="delete-log-btn" data-os-id="${os.id}" data-log-id="${logId}" title="Excluir"><i class='bx bx-x text-lg'></i></button>`
        : '';

      const descriptionHTML = log.description && log.description.startsWith('ATT EXCLUIDA')
        ? `<p class="text-red-500 italic text-sm">${log.description}</p>`
        : `<p class="text-gray-700 text-sm">${log.description || ''}</p>`;

      return `<div class="timeline-item ${itemClass}"><div class="timeline-icon"><i class='bx ${iconClass}'></i></div><div class="bg-gray-50 p-3 rounded-lg relative">${deleteButtonHTML}<div class="flex justify-between items-start mb-1"><h4 class="font-semibold text-gray-800 text-sm">${log.user}</h4><span class="text-xs text-gray-500">${formattedDate} ${formattedTime}</span></div>${descriptionHTML}${log.parts ? `<p class="text-gray-600 text-xs mt-1"><strong>Peças:</strong> ${log.parts}</p>` : ''}${log.value ? `<p class="text-green-600 text-xs mt-1"><strong>Valor:</strong> R$ ${parseFloat(log.value).toFixed(2)}</p>` : ''}</div></div>`;
    }).join('');

    if (logEntries.length === 0) timelineContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum registro encontrado.</p>';
  };

  const renderMediaGallery = (os) => {
    const media = os.media || {};
    const mediaEntries = Object.entries(media);
    lightboxMedia = mediaEntries.map(entry => ({...entry[1], key: entry[0]}));
    
    thumbnailGrid.innerHTML = mediaEntries.map(([key, item], index) => {
        if (!item || !item.url) return '';
        const canDelete = currentUser && (currentUser.role === 'Gestor' || currentUser.name === 'Thiago Ventura Valencio');
        const deleteButtonHTML = canDelete 
            ? `<button class="delete-media-btn" data-os-id="${os.id}" data-media-key="${key}" title="Excluir Mídia"><i class='bx bxs-trash'></i></button>` 
            : '';
        
        let thumbnailContent = `<i class='bx bx-file text-4xl text-gray-500'></i>`;
        if (item.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || item.type.startsWith('image/')) { 
            thumbnailContent = `<img src="${item.url}" alt="Imagem ${index + 1}" loading="lazy" class="w-full h-full object-cover">`; 
        } else {
             thumbnailContent = `<i class='bx bx-play-circle text-4xl text-blue-500'></i>`;
        }

        return `<div class="thumbnail-container aspect-square bg-gray-200 rounded-md overflow-hidden flex items-center justify-center relative">${deleteButtonHTML}<div class="thumbnail-item w-full h-full cursor-pointer" data-index="${index}">${thumbnailContent}</div></div>`;
    }).join('');

    if (mediaEntries.length === 0) thumbnailGrid.innerHTML = `<div class="col-span-full text-center py-8 text-gray-400"><i class='bx bx-image text-4xl mb-2'></i><p class="text-sm">Nenhuma mídia adicionada</p></div>`;
  };

  // 7. EXPORTAÇÃO OS (HTML - Padrão CHEVRON)
  const exportOsToPrint = (osId) => {
    const os = allServiceOrders[osId];
    if (!os) { showNotification('Dados da O.S. não encontrados.', 'error'); return; }
    
    const formatDate = (isoString) => isoString ? new Date(isoString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
    
    const logs = os.logs ? Object.values(os.logs).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)) : [];
    let totalValue = 0;
    
    const timelineHtml = logs.map(log => {
        if (log.value) totalValue += parseFloat(log.value);
        return `<tr><td>${formatDate(log.timestamp)}</td><td>${log.user}</td><td>${log.description}</td><td>${log.parts || '---'}</td><td style="text-align: right;">${log.value ? `R$ ${parseFloat(log.value).toFixed(2)}` : '---'}</td></tr>`;
    }).join('');
    
    const media = os.media ? Object.values(os.media) : [];
    const photos = media.filter(item => item && (item.type.startsWith('image/') || item.url.match(/\.(jpeg|jpg|gif|png|webp)$/i)));
    const photosHtml = photos.length > 0 ? `<div class="section"><h2>Fotos Anexadas</h2><div class="photo-gallery">${photos.map(photo => `<img src="${photo.url}" alt="Foto da O.S.">`).join('')}</div></div>` : '';

    const printHtml = `<html><head><title>Ordem de Serviço - ${os.placa}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;margin:0;padding:20px;color:#333}.container{max-width:800px;margin:auto}.header{text-align:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px}.header h1{margin:0;font-size:24px}.header p{margin:5px 0}.section{margin-bottom:20px;border:1px solid #ccc;border-radius:8px;padding:15px;page-break-inside:avoid}.section h2{margin-top:0;font-size:18px;border-bottom:1px solid #eee;padding-bottom:5px;margin-bottom:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.grid-item strong{display:block;color:#555}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:14px}th{background-color:#f2f2f2}.total{text-align:right;font-size:18px;font-weight:bold;margin-top:20px}.footer{text-align:center;margin-top:50px;padding-top:20px;border-top:1px solid #ccc}.signature{margin-top:60px}.signature-line{border-bottom:1px solid #000;width:300px;margin:0 auto}.signature p{margin-top:5px;font-size:14px}.photo-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:10px}.photo-gallery img{width:100%;height:auto;border:1px solid #ddd;border-radius:4px}.dev-signature{margin-top:40px;font-size:12px;color:#888;text-align:center}@media print{body{padding:10px}.no-print{display:none}}</style></head><body><div class="container"><div class="header"><h1>CENTER CAR MENECHELLI</h1><p>Ordem de Serviço</p></div><div class="section"><h2>Detalhes da O.S.</h2><div class="grid"><div class="grid-item"><strong>Placa:</strong> ${os.placa}</div><div class="grid-item"><strong>Modelo:</strong> ${os.modelo}</div><div class="grid-item"><strong>Cliente:</strong> ${os.cliente}</div><div class="grid-item"><strong>Telefone:</strong> ${os.telefone||"N/A"}</div><div class="grid-item"><strong>KM:</strong> ${os.km?new Intl.NumberFormat("pt-BR").format(os.km):"N/A"}</div><div class="grid-item"><strong>Data de Abertura:</strong> ${formatDate(os.createdAt)}</div><div class="grid-item"><strong>Atendente:</strong> ${os.responsible||"N/A"}</div></div></div>${os.observacoes?`<div class="section"><h2>Queixa do Cliente / Observações Iniciais</h2><p style="white-space: pre-wrap;">${os.observacoes}</p></div>`:""}<div class="section"><h2>Histórico de Serviços e Peças</h2><table><thead><tr><th>Data/Hora</th><th>Usuário</th><th>Descrição</th><th>Peças</th><th style="text-align: right;">Valor</th></tr></thead><tbody>${timelineHtml||'<tr><td colspan="5" style="text-align: center;">Nenhum registro no histórico.</td></tr>'}</tbody></table><div class="total">Total: R$ ${totalValue.toFixed(2)}</div></div>${photosHtml}<div class="footer"><div class="signature"><div class="signature-line"></div><p>Assinatura do Cliente</p></div><p>Documento gerado em: ${new Date().toLocaleString("pt-BR")}</p><div class="dev-signature">Desenvolvido com 🤖 - por thIAguinho Soluções</div></div></div><script>window.onload=function(){window.print();setTimeout(function(){window.close()},100)}<\/script></body></html>`;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHtml);
    printWindow.document.close();
  };

  // 8. EVENT LISTENERS
  document.getElementById('addOSBtn').addEventListener('click', () => {
      document.getElementById('osForm').reset();
      const osResp = document.getElementById('osResponsavel');
      osResp.innerHTML = '<option value="">Selecione...</option>' + allUsers.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
      document.getElementById('osModal').classList.remove('hidden'); 
      document.getElementById('osModal').classList.add('flex');
  });

  document.getElementById('osForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const priority = document.querySelector('input[name="osPrioridade"]:checked').value;
      const osData = {
          placa: document.getElementById('osPlaca').value.toUpperCase(),
          modelo: document.getElementById('osModelo').value,
          cliente: document.getElementById('osCliente').value,
          telefone: document.getElementById('osTelefone').value,
          km: parseInt(document.getElementById('osKm').value) || 0,
          responsible: document.getElementById('osResponsavel').value,
          observacoes: document.getElementById('osObservacoes').value,
          priority: priority,
          status: 'Aguardando-Mecanico',
          createdAt: new Date().toISOString(),
          lastUpdate: new Date().toISOString()
      };
      
      db.ref('serviceOrders').push(osData)
        .then(() => {
            document.getElementById('osModal').classList.add('hidden');
            showNotification('O.S. Criada com Sucesso!');
        })
        .catch(err => showNotification('Erro ao criar: ' + err.message, 'error'));
  });

  document.getElementById('exportOsBtn').addEventListener('click', () => {
      exportOsToPrint(document.getElementById('logOsId').value);
  });

  // LOGS E UPLOADS (Fluxo CHEVRON)
  logForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Salvando...`;
      
      const osId = document.getElementById('logOsId').value;
      const description = document.getElementById('logDescricao').value;
      const parts = document.getElementById('logPecas').value;
      const value = document.getElementById('logValor').value;

      try {
          if (filesToUpload && filesToUpload.length > 0) {
              const mediaPromises = filesToUpload.map(file => uploadFileToCloudinary(file));
              const mediaResults = await Promise.all(mediaPromises);
              
              mediaResults.forEach(result => {
                  db.ref(`serviceOrders/${osId}/media`).push({
                      url: result.url,
                      type: result.type,
                      configKey: result.configKey,
                      timestamp: new Date().toISOString()
                  });
              });
          }

          if (description.trim() || parts || value) {
              const logEntry = { 
                  timestamp: new Date().toISOString(), 
                  user: currentUser.name, 
                  description: description, 
                  type: 'log', 
                  parts: parts || null, 
                  value: value || null 
              };
              await db.ref(`serviceOrders/${osId}/logs`).push().set(logEntry);
          }

          logForm.reset();
          filesToUpload = [];
          document.getElementById('fileName').textContent = '';
          document.getElementById('post-log-actions').style.display = 'block'; // Mostra opções de movimento
          showNotification('Registro adicionado!');

      } catch (error) {
          console.error(error);
          showNotification('Erro: ' + error.message, 'error');
      } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<i class='bx bx-message-square-add'></i> Adicionar ao Histórico`;
      }
  });

  // Botões de Movimentação (Pós-log)
  document.getElementById('btn-move-next').addEventListener('click', () => {
    const osId = document.getElementById('logOsId').value;
    const os = allServiceOrders[osId];
    const nextStatus = STATUS_LIST[STATUS_LIST.indexOf(os.status) + 1];
    if (nextStatus) { updateServiceOrderStatus(osId, nextStatus); detailsModal.classList.add('hidden'); }
  });

  document.getElementById('btn-move-prev').addEventListener('click', () => {
    const osId = document.getElementById('logOsId').value;
    const os = allServiceOrders[osId];
    const prevStatus = STATUS_LIST[STATUS_LIST.indexOf(os.status) - 1];
    if (prevStatus) { updateServiceOrderStatus(osId, prevStatus); detailsModal.classList.add('hidden'); }
  });

  document.getElementById('btn-stay').addEventListener('click', () => { 
      document.getElementById('post-log-actions').style.display = 'none'; 
  });

  // Eventos Gerais (Toggle, Busca, Admin Tabs)
  document.getElementById('toggle-panel-btn').addEventListener('click', () => {
      const p = document.getElementById('attention-panel-container');
      const icon = document.querySelector('#toggle-panel-btn i');
      p.classList.toggle('collapsed');
      icon.classList.toggle('rotate-180');
      updateAttentionPanel();
  });

  kanbanBoard.addEventListener('click', (e) => {
    const card = e.target.closest('.vehicle-card');
    const moveBtn = e.target.closest('.btn-move-status');
    const clickableArea = e.target.closest('.card-clickable-area');
    const toggleBtn = e.target.closest('.toggle-column-btn');

    if (moveBtn) {
      e.stopPropagation();
      updateServiceOrderStatus(moveBtn.dataset.osId, moveBtn.dataset.newStatus);
    } else if (clickableArea && card) {
      openDetailsModal(card.dataset.osId);
    } else if (toggleBtn) {
      const status = toggleBtn.dataset.status;
      const vehicleList = kanbanBoard.querySelector(`.vehicle-list[data-status="${status}"]`);
      vehicleList.classList.toggle('collapsed');
      toggleBtn.querySelector('i').classList.toggle('rotate-180');
      
      const collapsedState = JSON.parse(localStorage.getItem('collapsedColumns')) || {};
      collapsedState[status] = vehicleList.classList.contains('collapsed');
      localStorage.setItem('collapsedColumns', JSON.stringify(collapsedState));
      
      const columnLed = toggleBtn.querySelector('.column-led');
      if (columnLed) columnLed.style.display = (collapsedState[status] && vehicleList.children.length > 0) ? 'block' : 'none';
    }
  });

  kanbanBoard.addEventListener('input', (e) => {
      if (e.target.matches('.search-input-entregue')) {
          renderDeliveredColumn();
      }
  });

  // Busca Global
  globalSearchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toUpperCase().trim();
    if (!searchTerm) {
        globalSearchResults.innerHTML = '';
        globalSearchResults.classList.add('hidden');
        return;
    }
    const matchingOrders = Object.values(allServiceOrders)
        .filter(os => os.placa && os.placa.toUpperCase().includes(searchTerm))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); 

    if (matchingOrders.length > 0) {
        globalSearchResults.innerHTML = matchingOrders.map(os => `
            <div class="search-result-item" data-os-id="${os.id}">
                <p class="font-bold">${os.placa} - ${os.modelo}</p>
                <p class="text-sm text-gray-600">Status: <span class="font-semibold text-blue-700">${formatStatus(os.status)}</span></p>
            </div>
        `).join('');
        globalSearchResults.classList.remove('hidden');
    } else {
        globalSearchResults.innerHTML = '<div class="p-3 text-center text-gray-500">Nenhum veículo encontrado.</div>';
        globalSearchResults.classList.remove('hidden');
    }
  });

  globalSearchResults.addEventListener('click', (e) => {
      const resultItem = e.target.closest('.search-result-item');
      if (resultItem) {
          openDetailsModal(resultItem.dataset.osId);
          globalSearchInput.value = '';
          globalSearchResults.classList.add('hidden');
      }
  });

  // Inputs Mídia
  const mediaInp = document.getElementById('media-input');
  mediaInp.addEventListener('change', (e) => {
      if (e.target.files.length > 0) filesToUpload = Array.from(e.target.files);
      document.getElementById('fileName').textContent = filesToUpload.length > 0 ? `${filesToUpload.length} arquivo(s)` : '';
  });
  document.getElementById('openCameraBtn').onclick = () => { mediaInp.setAttribute('capture','camera'); mediaInp.click(); };
  document.getElementById('openGalleryBtn').onclick = () => { mediaInp.removeAttribute('capture'); mediaInp.click(); };

  // Lightbox
  const openLightbox = (index) => {
    if (!lightboxMedia || lightboxMedia.length === 0) return;
    currentLightboxIndex = index;
    const media = lightboxMedia[index];
    const lightboxContent = document.getElementById('lightbox-content');
    
    if (media.type && media.type === 'application/pdf') { 
        window.open(media.url, '_blank'); 
        return; 
    }

    if (media.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || (media.type && media.type.startsWith('image/'))) {
      lightboxContent.innerHTML = `<img src="${media.url}" class="max-w-full max-h-full object-contain">`;
    } else {
      lightboxContent.innerHTML = `<video src="${media.url}" controls class="max-w-full max-h-full"></video>`;
    }
    
    document.getElementById('lightbox-download').href = media.url;
    document.getElementById('lightbox').classList.remove('hidden');
    document.getElementById('lightbox').classList.add('flex');
  };

  thumbnailGrid.addEventListener('click', (e) => {
      const item = e.target.closest('.thumbnail-item');
      const delBtn = e.target.closest('.delete-media-btn');
      if (delBtn) {
          e.stopPropagation();
          const { osId, mediaKey } = delBtn.dataset;
          document.getElementById('confirmDeleteMediaBtn').dataset.osId = osId;
          document.getElementById('confirmDeleteMediaBtn').dataset.mediaKey = mediaKey;
          document.getElementById('confirmDeleteMediaModal').classList.remove('hidden');
          document.getElementById('confirmDeleteMediaModal').classList.add('flex');
          return;
      }
      if (item) openLightbox(parseInt(item.dataset.index));
  });
  
  document.getElementById('lightbox-close').onclick = () => document.getElementById('lightbox').classList.add('hidden');
  document.getElementById('lightbox-prev').onclick = () => { if(currentLightboxIndex > 0) openLightbox(currentLightboxIndex - 1); };
  document.getElementById('lightbox-next').onclick = () => { if(currentLightboxIndex < lightboxMedia.length - 1) openLightbox(currentLightboxIndex + 1); };

  // Admin Modal & Tabs
  adminBtn.addEventListener('click', () => { adminModal.classList.remove('hidden'); adminModal.classList.add('flex'); });
  
  document.querySelectorAll('.admin-tab').forEach(t => t.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(x => {
          x.classList.remove('active', 'border-blue-600', 'text-blue-600', 'bg-blue-50/30');
          x.classList.add('text-gray-500');
      });
      t.classList.add('active', 'border-blue-600', 'text-blue-600', 'bg-blue-50/30');
      t.classList.remove('text-gray-500');
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
      document.getElementById(t.dataset.target).classList.remove('hidden');
  }));

  const renderAdminUserList = () => {
      const list = document.getElementById('usersList');
      if(!list) return;
      list.innerHTML = allUsers.map(u => `
          <div class="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
              <div>
                  <p class="font-bold text-gray-800 text-sm">${u.name}</p>
                  <p class="text-xs text-gray-500">${u.role} | Senha: ${u.password}</p>
              </div>
              ${u.name !== 'Thiago Ventura Valencio' ? `<button onclick="window.removeUser('${u.id}')" class="text-red-500 hover:bg-red-50 p-2 rounded transition"><i class='bx bxs-trash'></i></button>` : '<span class="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded">MASTER</span>'}
          </div>
      `).join('');
  };
  
  window.removeUser = (id) => { if(confirm('Remover usuário?')) db.ref(`users/${id}`).remove(); };

  document.getElementById('addUserForm').addEventListener('submit', (e) => {
      e.preventDefault();
      db.ref('users').push({
          name: document.getElementById('newUserName').value,
          role: document.getElementById('newUserRole').value,
          password: document.getElementById('newUserPass').value
      });
      e.target.reset(); showNotification('Usuário Cadastrado!');
  });

  document.getElementById('cloudinaryForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const cloudName = document.getElementById('cloudNameInput').value;
      const preset = document.getElementById('uploadPresetInput').value;
      if (cloudName && preset) {
          db.ref('cloudinaryConfigs').push({
              cloudName: cloudName,
              uploadPreset: preset,
              addedBy: currentUser.name,
              timestamp: firebase.database.ServerValue.TIMESTAMP
          });
          showNotification('Configuração Salva!');
      }
  });

  // Fechar Modais
  document.querySelectorAll('.btn-close-modal').forEach(b => b.addEventListener('click', (e) => e.target.closest('.modal').classList.add('hidden')));
  
  // Confirmações Exclusão
  document.getElementById('confirmDeleteMediaBtn').onclick = async () => {
      const { osId, mediaKey } = document.getElementById('confirmDeleteMediaBtn').dataset;
      await db.ref(`serviceOrders/${osId}/media/${mediaKey}`).remove();
      document.getElementById('confirmDeleteMediaModal').classList.add('hidden');
      showNotification('Mídia Excluída.');
  };
  document.getElementById('cancelDeleteMediaBtn').onclick = () => document.getElementById('confirmDeleteMediaModal').classList.add('hidden');

});
