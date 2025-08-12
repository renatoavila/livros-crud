// =================================================================
// CONFIGURAÇÃO E VARIÁVEIS GLOBAIS
// =================================================================


const API_URL = 'https://script.google.com/macros/s/AKfycbzG9uM4nyt992rv5jF8ZAkaveLrc1TnCL4I1LHkAqfIomdAkcQVZAS7d9ya8uyd7Z-g/exec';

// Seletores do DOM
const livroForm = document.getElementById("livroForm");
const salvarBtn = document.getElementById("salvarBtn");
const formLoading = document.getElementById("formLoading");
const tableLoading = document.getElementById("tableLoading");
const table = document.getElementById("table");
const paginas = document.getElementById("paginas");
const livrosTbody = document.getElementById("livrosTable");
const toastContainer = document.getElementById("toastContainer");
const modalElement = new bootstrap.Modal(document.getElementById('livroModal'));

// Variáveis de paginação
let currentPage = 1;
let itemsPerPage = 10; // Valor padrão
let allBooks = [];
let filteredBooks = [];

// =================================================================
// FUNÇÕES DE UI (INTERFACE DO USUÁRIO)
// =================================================================

/**
 * Mostra uma notificação (toast) na tela.
 * @param {string} message A mensagem a ser exibida.
 * @param {'success' | 'danger'} type O tipo de notificação (verde para sucesso, vermelho para erro).
 */
function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast align-items-center text-bg-${type} border-0 show mb-2`;
    toast.role = "alert";
    toast.innerHTML = `
       <div class="d-flex">
         <div class="toast-body">${type === 'success' ? '✅' : '❌'} ${message}</div>
         <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
       </div>
     `;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 5000); // O toast desaparece após 5 segundos
}

/** Ativa/desativa o estado de carregamento do formulário. */
function toggleFormLoading(isLoading) {
    salvarBtn.disabled = isLoading;
    formLoading.classList.toggle("d-none", !isLoading);
}

/** Ativa/desativa o estado de carregamento da tabela. */
function toggleTableLoading(isLoading) {
    tableLoading.classList.toggle("d-none", !isLoading);
    table.classList.toggle("d-none", isLoading);
    paginas.classList.toggle("d-none", isLoading);
}

/** Abre o modal para adicionar um novo livro, limpando o formulário. */
function abrirModalNovoLivro() {
    livroForm.reset();
    document.getElementById("livroId").value = "";
    document.getElementById("titulo").value = "";
    document.getElementById("autor").value = "";
    document.getElementById("ano").value = "";
    document.getElementById("local").value = "";
    document.getElementById("data").value = "";
    document.getElementById("genero").value = "";
    document.getElementById("sttela").checked = false;
    document.getElementById("renato").checked = false;

    document.getElementById("livroModalLabel").textContent = "📚 Adicionar Novo Livro";
    modalElement.show();
}

function formatarDataParaInputDate(isoDate) {
    if (!isoDate) return "";
    const date = new Date(isoDate);
    const ano = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

/** Preenche o modal com os dados de um livro para edição. */
function abrirModalEditar(livro) {
    livroForm.reset();
    document.getElementById("livroId").value = livro.id;
    document.getElementById("titulo").value = livro.titulo;
    document.getElementById("autor").value = livro.autor;
    document.getElementById("ano").value = livro.ano || "";
    document.getElementById("local").value = livro.local || "";
    document.getElementById("data").value = formatarDataParaInputDate(livro.data) || "";
    document.getElementById("genero").value = livro.genero || "";
    document.getElementById("sttela").checked = livro.sttela === "Sim";
    document.getElementById("renato").checked = livro.renato === "Sim";
    document.getElementById("livroModalLabel").textContent = "📚 Editar Livro";
    modalElement.show();
}

// =================================================================
// FUNÇÕES DE API (COMUNICAÇÃO COM O BACK-END)
// =================================================================

/**
 * Centraliza todas as requisições POST para a API, resolvendo o problema de CORS.
 * @param {object} payload O corpo da requisição com a ação e os dados.
 * @returns {Promise<object>} A resposta da API em formato JSON.
 */
async function postApi(payload) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                // O SEGREDO PARA EVITAR O ERRO CORS/OPTIONS
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Erro na rede: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Erro na chamada da API (POST):", error);
        showToast("Erro de comunicação com o servidor.", "danger");
        // Retorna um objeto de erro consistente para não quebrar o código que chama esta função
        return { success: false, message: "Erro de comunicação." };
    }
}

/** Carrega e renderiza a lista de livros da API. */
async function carregarLivros() {
    toggleTableLoading(true);
    livrosTbody.innerHTML = '';

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Falha ao carregar os dados.");

        const result = await response.json();
        if (!result.success || !Array.isArray(result.data)) {
            throw new Error("A resposta da API não está no formato esperado.");
        }

        // Armazena todos os livros e os livros filtrados (inicialmente iguais)
        allBooks = result.data.sort((a, b) => a.titulo.localeCompare(b.titulo));
        filteredBooks = [...allBooks];

        renderTable();
    } catch (error) {
        console.error("Erro ao carregar livros:", error);
        showToast("Não foi possível carregar a lista de livros.", "danger");
        livrosTbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Falha ao carregar dados.</td></tr>';
    } finally {
        toggleTableLoading(false);
    }
    const stats = calculateStats();
    renderStatsCards(stats);
    renderCharts(stats);
}

// =================================================================
// MANIPULADORES DE EVENTOS (EVENT HANDLERS)
// =================================================================

/** Manipula o envio do formulário para criar ou atualizar um livro. */
livroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    toggleFormLoading(true);

    const id = document.getElementById("livroId").value;
    const livroData = {
        id: document.getElementById("livroId").value,
        titulo: document.getElementById("titulo").value.trim().replace(/\s+/g, ' '),
        autor: document.getElementById("autor").value.trim().replace(/\s+/g, ' '),
        ano: document.getElementById("ano").value.trim().replace(/\s+/g, ' '),
        local: document.getElementById("local").value.trim().replace(/\s+/g, ' '),
        data: document.getElementById("data").value.trim().replace(/\s+/g, ' '),
        genero: document.getElementById("genero").value.trim().replace(/\s+/g, ' '),
        sttela: document.getElementById("sttela").checked ? "Sim" : "Não",
        renato: document.getElementById("renato").checked ? "Sim" : "Não"
    };

    // Cria o payload com a ação correta (create ou update)
    const payload = id
        ? { action: "update", id, ...livroData }
        : { action: "create", ...livroData };

    const result = await postApi(payload);

    if (result.success) {
        showToast(result.message || "Operação realizada com sucesso!");
        modalElement.hide();
        carregarLivros(); // Recarrega a lista para mostrar as mudanças
    } else {
        showToast(result.message || "Ocorreu um erro.", "danger");
    }
    document.getElementById('buscaInput').value = "";
    toggleFormLoading(false); // Desativa o loading APÓS a operação terminar
});

/** Pede confirmação e, se confirmado, exclui um livro. */
async function confirmarExclusao(livro) {
    const confirmado = await mostrarConfirmacao(`Tem certeza que deseja excluir o livro "${livro.titulo}"?`);
    if (!confirmado) return;

    toggleTableLoading(true); // Mostra um loading na tabela durante a exclusão

    const result = await postApi({ action: "delete", id: livro.id });

    if (result.success) {
        showToast(result.message || "Livro excluído com sucesso!");
        carregarLivros(); // Recarrega a lista
        document.getElementById('buscaInput').value
    } else {
        showToast(result.message || "Falha ao excluir o livro.", "danger");
        toggleTableLoading(false); // Esconde o loading se falhar
    }
}

function mostrarConfirmacao(msg) {
    return new Promise(resolve => {
        const modalHtml = `
       <div class="modal fade" id="confirmModal" tabindex="-1">
         <div class="modal-dialog modal-dialog-centered">
           <div class="modal-content">
             <div class="modal-header">
               <h5 class="modal-title">Confirmar Ação</h5>
               <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
             </div>
             <div class="modal-body">
               <p>${msg}</p>
             </div>
             <div class="modal-footer">
               <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
               <button type="button" class="btn btn-danger" id="confirmBtn">Confirmar</button>
             </div>
           </div>
         </div>
       </div>
     `;

        document.body.insertAdjacentHTML("beforeend", modalHtml);
        const confirmModalEl = document.getElementById("confirmModal");
        const bsModal = new bootstrap.Modal(confirmModalEl);
        let isResolved = false;

        bsModal.show();

        confirmModalEl.querySelector("#confirmBtn").onclick = () => {
            if (!isResolved) {
                isResolved = true;
                resolve(true);
                bsModal.hide();
            }
        };

        confirmModalEl.addEventListener("hidden.bs.modal", () => {
            if (!isResolved) {
                isResolved = true;
                resolve(false);
            }
            confirmModalEl.remove();
        });
    });
}

// =================================================================
// BUSCA
// =================================================================

function filtrarTabela() {
  // 1. Normaliza o termo da busca UMA VEZ, para maior eficiência.
  const filtroNormalizado = removerAcentos(document.getElementById('buscaInput').value.trim().replace(/\s+/g, ' '));
 
  if (filtroNormalizado.trim() === "") {
    filteredBooks = [...allBooks];
  } else {
    filteredBooks = allBooks.filter(livro => {
      // 2. Normaliza os dados de cada livro ANTES de fazer a comparação.
      const tituloNormalizado = removerAcentos(livro.titulo);
      const autorNormalizado = removerAcentos(livro.autor);
      const generoNormalizado = removerAcentos(livro.genero);
      
      return (
        tituloNormalizado.includes(filtroNormalizado) ||
        autorNormalizado.includes(filtroNormalizado) ||
        generoNormalizado.includes(filtroNormalizado)
      );
    });
  }
 

  // Reset para a primeira página após filtrar
  currentPage = 1;
  renderTable();

  // Mostra mensagem se não encontrar resultados
  const mensagem = document.getElementById("mensagemSemResultados");
  const termo = document.getElementById("termoBuscado");

  if (filteredBooks.length === 0 && filtroNormalizado.trim() !== "") {
    // Mostra o termo original digitado pelo usuário na mensagem
    termo.textContent = document.getElementById('buscaInput').value;
    mensagem.classList.remove("d-none");
  } else {
    mensagem.classList.add("d-none");
  }
}

/**
 * Remove acentos de uma string, converte para minúsculas e a retorna.
 * Ex: "Ficção Científica" se torna "ficcao cientifica"
 * @param {string} texto O texto a ser normalizado.
 * @returns {string} O texto normalizado.
 */
function removerAcentos(texto) {
  // Retorna uma string vazia se a entrada for nula ou indefinida
  if (!texto) return ""; 
  
  return texto
    .toLowerCase() // Converte para minúsculas
    .normalize("NFD") // Separa os acentos das letras (ex: 'á' vira 'a' + '´')
    .replace(/[\u0300-\u036f]/g, ""); // Remove os acentos usando uma expressão regular
}


// =================================================================
// INICIALIZAÇÃO
// =================================================================

let html5QrCode;

// Substitua sua função abrirLeitorCodigoBarras por esta:
function abrirLeitorCodigoBarras() {
    const barcodeModal = new bootstrap.Modal(document.getElementById('barcodeModal'));
    barcodeModal.show();

    // Aguarda o modal estar visível para iniciar a câmera
    document.getElementById('barcodeModal').addEventListener('shown.bs.modal', () => {
        const qrCodeRegionId = "reader";
        html5QrCode = new Html5Qrcode(qrCodeRegionId);

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
            { facingMode: "environment" }, // Usa a câmera traseira
            config,
            (decodedText, decodedResult) => {
                // SUCESSO NA LEITURA
                fecharLeitor();
                if (/^\d{10,13}$/.test(decodedText)) {
                    buscarLivroPorISBN(decodedText);
                } else {
                    showToast("O código lido não parece ser um ISBN válido.", "danger");
                }
            },
            (errorMessage) => {
                // Erros de leitura podem ser ignorados, pois acontecem constantemente.
            }
        ).catch(err => {
            console.error(`Erro ao iniciar o leitor de código de barras: ${err}`);
            showToast("Não foi possível acessar a câmera. Verifique as permissões.", "danger");
            const barcodeModalInstance = bootstrap.Modal.getInstance(document.getElementById('barcodeModal'));
            if (barcodeModalInstance) barcodeModalInstance.hide();
        });
    }, { once: true }); // O evento só precisa ser escutado uma vez
}

function fecharLeitor() {
    const barcodeModalEl = document.getElementById('barcodeModal');
    const barcodeModalInstance = bootstrap.Modal.getInstance(barcodeModalEl);

    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            html5QrCode = null; // Limpa a variável
            if (barcodeModalInstance) barcodeModalInstance.hide();
        }).catch(err => {
            console.error("Erro ao parar o leitor: ", err);
            if (barcodeModalInstance) barcodeModalInstance.hide(); // Força o fechamento mesmo com erro
        });
    } else {
        if (barcodeModalInstance) barcodeModalInstance.hide();
    }
}

function pararLeitorCamera() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop()
            .then(() => {
                console.log("Leitor de câmera parado com sucesso.");
            })
            .catch(err => {
                // Mesmo que dê erro ao parar, não há muito o que fazer,
                // mas é bom registrar no console.
                console.error("Não foi possível parar o leitor de câmera de forma limpa.", err);
            });
    }
}
async function buscarLivroPorISBN(isbn) {
    toggleFormLoading(true);

    let data;
    let title;
    let authors;
    let year;
    try {
        const resp = await fetch(`https://brasilapi.com.br/api/isbn/v1/${isbn}?providers=open-library|mercado-editorial`);
        if (resp.ok) {
            data = await resp.json();
            title = data.title;
            authors = data.authors;
            year = data.year;
        }
    } catch { }

    if (!title || !authors) {
        try {
            const resp2 = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
            const jb = await resp2.json();
            const info = jb.items?.[0]?.volumeInfo;
            if (info) {
                // Preenche apenas os campos que estão faltando
                title = title || (info.subtitle ? `${info.title}: ${info.subtitle}` : info.title);
                authors = authors || info.authors;
                year = year || info.publishedDate;
            }
        } catch {
            showToast("Erro ao consultar APIs.", "danger");
        }
    }

    if (title && authors) {
        preencherLivro(title, authors, year);
    } else {
        showToast("Livro não encontrado nas APIs consultadas.", "danger");
    }

    toggleFormLoading(false);
}

function preencherLivro(title, authors, publishedDate) {
    livroForm.reset();
    document.getElementById("livroId").value = "";
    document.getElementById("titulo").value = title ? capitalizeComExcecoes(title) : "";
    document.getElementById("autor").value = authors
        ? authors.map(nome => capitalizeComExcecoes(nome)).join(" | ")
        : "";
    document.getElementById("ano").value = publishedDate || "";
    modalElement.show();
}

function capitalizeComExcecoes(texto) {
    const palavrasPequenas = ["a", "o", "as", "os", "de", "do", "da", "dos", "das", "e", "em", "no", "na", "nos", "nas", "por", "com", "para", "uma", "um", "uns", "umas"];

    return texto
        .toLowerCase()
        .split(' ')
        .map((palavra, index) => {
            if (index === 0 || !palavrasPequenas.includes(palavra)) {
                return palavra.charAt(0).toUpperCase() + palavra.slice(1);
            }
            return palavra;
        })
        .join(' ');
}
function goToPage(page) {
    currentPage = page;
    renderTable();
}

function updatePaginationControls() {
    const totalPages = Math.ceil(filteredBooks.length / itemsPerPage);
    document.getElementById('pageInfo').textContent = `Página ${currentPage} de ${totalPages}`;

    document.getElementById('prevPage').disabled = currentPage <= 1;
    document.getElementById('nextPage').disabled = currentPage >= totalPages;
}

function updateItemsPerPage() {
    itemsPerPage = parseInt(document.getElementById('itemsPerPageSelect').value);
    currentPage = 1; // Reset para a primeira página
    renderTable();
}

function renderTable() {
    livrosTbody.innerHTML = '';

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const booksToShow = filteredBooks.slice(startIndex, endIndex);

    if (booksToShow.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = '<td colspan="6" class="text-center">Nenhum livro encontrado.</td>';
        livrosTbody.appendChild(tr);
    } else {
        booksToShow.forEach(livro => {
            const tr = document.createElement("tr");
            const genero = livro.genero && livro.genero.trim() !== "" ? livro.genero : "Não informado";
            const statusLeituraSttela = livro.sttela && livro.sttela.trim().toLowerCase() !== "não" ? "✅" : "";
            const statusLeituraRenato = livro.renato && livro.renato.trim().toLowerCase() !== "não" ? "✅" : "";

            tr.innerHTML = `
                <td class="align-middle">
                    <div class="text-truncate"  data-bs-toggle="tooltip" style="max-width: 400px;" title="${livro.titulo}">${livro.titulo}</div>
                </td>
                <td class="align-middle d-none d-md-table-cell">
                    <div class="text-truncate" style="max-width: 160px;" title="${livro.autor}">${livro.autor}</div>
                </td>
                <td class="align-middle d-none d-md-table-cell">
                    <div class="text-truncate" style="max-width: 120px;" title="${genero}">${genero}</div>
                </td>
                <td class="align-middle d-none d-md-table-cell text-center" style="width: 40px;">${statusLeituraSttela}</td>
                <td class="align-middle d-none d-md-table-cell text-center" style="width: 40px;">${statusLeituraRenato}</td>
                <td class="align-middle text-end text-nowrap" style="width: 80px;">
                    <button class="btn btn-sm me-1 edit" title="Editar">✏️</button>
                    <button class="btn btn-sm remove" title="Excluir">🗑️</button>
                </td>
            `;
            tr.querySelector('.edit').addEventListener('click', () => abrirModalEditar(livro));
            tr.querySelector('.remove').addEventListener('click', () => confirmarExclusao(livro));

            livrosTbody.appendChild(tr);
        });
    }

    updatePaginationControls();
}
// Adicione isso no final do seu script
document.getElementById('itemsPerPageSelect').addEventListener('change', updateItemsPerPage);
document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) goToPage(currentPage - 1);
});
document.getElementById('nextPage').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredBooks.length / itemsPerPage);
    if (currentPage < totalPages) goToPage(currentPage + 1);
});


function calculateStats() {
    const books = allBooks;
    const totalBooks = books.length;

    // Livros lidos por Sttela e Renato
    const sttelaRead = books.filter(book => book.sttela === "Sim").length;
    const renatoRead = books.filter(book => book.renato === "Sim").length;
    const bothRead = books.filter(book => book.sttela === "Sim" && book.renato === "Sim").length;
    const readBySomeone = books.filter(book => book.sttela === "Sim" || book.renato === "Sim").length;
    const unread = books.filter(book => book.sttela === "Não" && book.renato === "Não").length;    
    const readBooks = books.filter(book => book.sttela === "Sim" || book.renato === "Sim");

    // Contagem por gênero
    const genreCount = {};
    books.forEach(book => {
        const genre = book.genero || "Desconhecido";
        genreCount[genre] = (genreCount[genre] || 0) + 1;
    });

    const readGenreCount = {};
    readBooks.forEach(book => {
        const genre = book.genero || "Desconhecido";
        readGenreCount[genre] = (readGenreCount[genre] || 0) + 1;
    });

    const authorCount = {};
    readBooks.forEach(book => {
        // Considera todos os autores (para casos de livros com múltiplos autores)
        const authors = book.autor.split('|').map(a => a.trim());
        authors.forEach(author => {
            authorCount[author] = (authorCount[author] || 0) + 1;
        });
    });

    return {
        totalBooks,
        sttelaRead,
        renatoRead,
        bothRead,
        readBySomeone,
        unread,
        genreCount,        
        readGenreCount,
        authorCount,
        readBooksCount: readBooks.length
    };
}

// Função para renderizar os cards de estatísticas
function renderStatsCards(stats) {
    const container = document.getElementById('stats-container');
    const cards = [
        {
            icon: "📚",
            value: stats.totalBooks,
            label: "Total de Livros",
            bg: "bg-primary bg-opacity-10",
            text: "text-primary"
        },
        {
            icon: "👩🏼",  // Mulher com tom de pele médio-claro
            value: stats.sttelaRead,
            label: "Lidos pela Sttela",
            bg: "bg-success bg-opacity-10",
            text: "text-success"
        },
        {
            icon: "👨🏼",  // Homem com tom de pele médio-claro
            value: stats.renatoRead,
            label: "Lidos pelo Renato",
            bg: "bg-info bg-opacity-10",
            text: "text-info"
        },
        {
            icon: "👫🏽",  // Casal com tom de pele médio-claro
            value: stats.bothRead,
            label: "Lidos por ambos",
            bg: "bg-warning bg-opacity-10",
            text: "text-warning"
        },
        {
            icon: "✅",
            value: stats.readBySomeone,
            label: "Lidos por alguém",
            bg: "bg-dark bg-opacity-10",
            text: "text-dark"
        },
        {
            icon: "🕒",
            value: stats.unread,
            label: "Aguardando leitura",
            bg: "bg-secondary bg-opacity-10",
            text: "text-secondary"
        }
    ];

    container.innerHTML = cards.map(card => `
                <div class="col-md-4 col-6">
                    <div class="stat-card p-4 ${card.bg} ${card.text}">
                        <div class="stat-icon">${card.icon}</div>
                        <div class="stat-value">${card.value}</div>
                        <div class="stat-label">${card.label}</div>
                    </div>
                </div>
            `).join('');
}
function renderMostReadGenresChart(readGenreCount) {
    // Ordenar gêneros por quantidade (do maior para o menor)
    const sortedGenres = Object.entries(readGenreCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6); // Pegar os top 6 gêneros
    
    const ctx = document.getElementById('mostReadGenresChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedGenres.map(g => g[0]),
            datasets: [{
                label: 'Livros Lidos',
                data: sortedGenres.map(g => g[1]),
                backgroundColor: 'rgba(75, 192, 192, 0.7)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Gráfico horizontal
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Gêneros Mais Lidos',
                    font: {
                        size: 16
                    }
                }
            }
        }
    });
}

function renderMostReadAuthorsChart(authorCount) {
    // Ordenar autores por quantidade (do maior para o menor)
    const sortedAuthors = Object.entries(authorCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Pegar os top 10 autores
    
    const ctx = document.getElementById('mostReadAuthorsChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedAuthors.map(a => a[0]),
            datasets: [{
                data: sortedAuthors.map(a => a[1]),
              backgroundColor: [
                'rgba(255, 99, 132, 0.7)',
                'rgba(54, 162, 235, 0.7)',
                'rgba(255, 206, 86, 0.7)',
                'rgba(75, 192, 192, 0.7)',
                'rgba(153, 102, 255, 0.7)',
                'rgba(255, 159, 64, 0.7)',
                'rgba(199, 199, 199, 0.7)',
                'rgba(83, 102, 255, 0.7)',
                'rgba(0, 200, 150, 0.7)',
                'rgba(100, 100, 100, 0.7)'
            ],
            borderColor: [
                'rgba(255, 99, 132, 1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)',
                'rgba(199, 199, 199, 1)',
                'rgba(83, 102, 255, 1)',
                'rgba(0, 200, 150, 1)',
                'rgba(100, 100, 100, 1)'
            ],

                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Autores Mais Lidos',
                    font: {
                        size: 16
                    }
                },
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12
                    }
                }
            }
        }
    });
}

// Funções separadas para cada gráfico
function renderReadingChart(stats) {
    const ctx = document.getElementById('readingChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Sttela', 'Renato', 'Ambos', 'Não lidos'],
            datasets: [{
                label: 'Livros lidos',
                data: [stats.sttelaRead, stats.renatoRead, stats.bothRead, stats.unread],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(153, 102, 255, 0.7)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderGenreChart(genreCount) {
    // Converte o objeto em um array de pares [gênero, contagem]
    const sortedGenres = Object.entries(genreCount)
        .sort((a, b) => b[1] - a[1]); // Ordena do maior para o menor

    const topGenres = sortedGenres.slice(0, 12);
    const otherGenres = sortedGenres.slice(12);

    const labels = topGenres.map(item => item[0]);
    const data = topGenres.map(item => item[1]);

    if (otherGenres.length > 0) {
        const otherTotal = otherGenres.reduce((sum, item) => sum + item[1], 0);
        labels.push('Outros');
        data.push(otherTotal);
    }

    const backgroundColors = [
        'rgba(255, 99, 132, 0.7)',
        'rgba(54, 162, 235, 0.7)',
        'rgba(255, 206, 86, 0.7)',
        'rgba(75, 192, 192, 0.7)',
        'rgba(153, 102, 255, 0.7)',
        'rgba(255, 159, 64, 0.7)',
        'rgba(201, 203, 207, 0.7)',
        'rgba(255, 99, 71, 0.7)',
        'rgba(100, 149, 237, 0.7)',
        'rgba(60, 179, 113, 0.7)',
        'rgba(220, 20, 60, 0.7)',
        'rgba(0, 191, 255, 0.7)',
        'rgba(169, 169, 169, 0.7)' // cor para 'Outros'
    ];

    const ctx = document.getElementById('genreChart').getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors.slice(0, labels.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}


function renderReadPercentageChart(stats) {
    const totalBooks = stats.readBooksCount + stats.unread;
    const readPercentage = totalBooks > 0 ? (stats.readBooksCount / totalBooks) * 100 : 0;
    const unreadPercentage = 100 - readPercentage;

    const ctx = document.getElementById('readPercentageChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [
                `Lidos (${readPercentage.toFixed(1)}%)`,
                `Não lidos (${unreadPercentage.toFixed(1)}%)`
            ],
            datasets: [{
                data: [stats.readBooksCount, stats.unread],
                backgroundColor: [
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(153, 102, 255, 0.7)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Progresso de Leitura: ${readPercentage.toFixed(1)}% lidos`,
                    font: { size: 16 }
                }
            }
        }
    });
}


// Função para renderizar os gráficos
function renderCharts(stats) {
    // Gráfico de leitura por pessoa (existente)
    renderReadingChart(stats);
    
    // Gráfico de gêneros (todos os livros)
    renderGenreChart(stats.genreCount);
    
    // Novos gráficos
    renderMostReadGenresChart(stats.readGenreCount);
    renderMostReadAuthorsChart(stats.authorCount);
    
    // Gráfico adicional: porcentagem de livros lidos
    renderReadPercentageChart(stats);
}


document.addEventListener('DOMContentLoaded', () => {
    carregarLivros();

    // Inicializa o seletor com o valor padrão
    document.getElementById('itemsPerPageSelect').value = itemsPerPage;
    document.getElementById('itemsPerPageSelect').addEventListener('change', updateItemsPerPage);

});
