// integral-github-sync.js
// Cliente leve para salvar/carregar o estado do app no repositório via GitHub API.
// Atenção: este fluxo usa um Personal Access Token (PAT) inserido manualmente pelo administrador.
// Guarde o token com segurança (sessionStorage) — nunca commit o token no repositório.

const GITHUB_OWNER = 'felixzsprofessor';
const GITHUB_REPO = 'Felixzs';
const GITHUB_PATH = 'data/desempenho_state.json';
const GITHUB_BRANCH = 'main';

function _base64EncodeUnicode(str){
  // safe base64 for unicode
  return btoa(unescape(encodeURIComponent(str)));
}

function getPat(){
  const el = document.getElementById('githubPat');
  if(el && el.value.trim()){
    sessionStorage.setItem('github_pat', el.value.trim());
    return el.value.trim();
  }
  return sessionStorage.getItem('github_pat') || null;
}

function setStatus(msg, isError){
  const s = document.getElementById('githubStatus');
  if(!s) return;
  s.textContent = msg || '';
  s.style.color = isError ? '#d9534f' : '';
}

async function saveToGithub(){
  try{
    const token = getPat();
    if(!token){ alert('Forneça o Personal Access Token (PAT) do GitHub nas Configurações.'); return; }
    // ensure state is saved to localStorage
    try{ salvar(); }catch(e){}
    const stateData = localStorage.getItem(STORAGE_KEY) || JSON.stringify(state);
    const contentBase64 = _base64EncodeUnicode(stateData);

    setStatus('Verificando arquivo no GitHub...');
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
    const hdr = { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' };
    let sha = null;
    const getRes = await fetch(url + `?ref=${GITHUB_BRANCH}`, { headers: hdr });
    if(getRes.status === 200){
      const json = await getRes.json();
      sha = json.sha;
    } else if(getRes.status === 404){
      sha = null; // create new
    } else if(getRes.status === 401 || getRes.status === 403){
      throw new Error('Autorização falhou (token inválido ou sem permissão).');
    } else {
      const t = await getRes.text();
      console.warn('GET file response', getRes.status, t);
    }

    const body = {
      message: 'Salvar estado via app (sincronização)',
      content: contentBase64,
      branch: GITHUB_BRANCH
    };
    if(sha) body.sha = sha;

    setStatus('Enviando commit para o repositório...');
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: Object.assign({'Content-Type':'application/json'}, hdr),
      body: JSON.stringify(body)
    });

    if(putRes.ok){
      setStatus('Salvo com sucesso no GitHub.');
      alert('Conteúdo salvo no repositório com sucesso.');
    } else {
      const j = await putRes.json().catch(()=>null);
      console.error('Erro ao salvar:', putRes.status, j);
      throw new Error((j && j.message) ? j.message : 'Erro desconhecido ao salvar no GitHub.');
    }
  }catch(err){
    console.error(err);
    setStatus('Erro: ' + err.message, true);
    alert('Falha ao salvar no GitHub: ' + err.message);
  }
}

async function loadFromGithub(){
  try{
    const token = getPat();
    if(!token){ alert('Forneça o Personal Access Token (PAT) do GitHub nas Configurações.'); return; }
    setStatus('Carregando arquivo do GitHub...');
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}?ref=${GITHUB_BRANCH}`;
    const hdr = { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' };
    const res = await fetch(url, { headers: hdr });
    if(res.status === 404){
      setStatus('Arquivo não encontrado no repositório.', true);
      alert('Nenhum arquivo sincronizado encontrado no repositório.');
      return;
    }
    if(!res.ok) throw new Error('Erro ao buscar arquivo: ' + res.status);
    const j = await res.json();
    const content = j.content;
    const decoded = decodeURIComponent(escape(atob(content.replace(/\n/g,''))));
    // Overwrite local state
    try{
      const parsed = JSON.parse(decoded);
      state = parsed;
      garantir();
      salvar();
      setStatus('Conteúdo carregado. Recarregando a página...');
      setTimeout(()=>location.reload(), 500);
    }catch(e){
      throw new Error('Conteúdo inválido: ' + e.message);
    }
  }catch(err){
    console.error(err);
    setStatus('Erro: ' + err.message, true);
    alert('Falha ao carregar do GitHub: ' + err.message);
  }
}

// Expor funções para console (útil para testes)
window.saveToGithub = saveToGithub;
window.loadFromGithub = loadFromGithub;
window.getPat = getPat;
